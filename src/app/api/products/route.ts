import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product, InventoryTransaction } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { productSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { sanitizeSearchQuery, getStockStatus } from "@/lib/utils";
import { sortProductsForCatalog, formatProductOptionLabel } from "@/lib/product-display";
import { getStockSplit, formatProductCatalogRates } from "@/lib/bill-pricing";
import { formatKgQty, isKgProduct, stockInputToStorage } from "@/lib/product-units";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: Record<string, unknown> = {};
    if (search) {
      const sanitized = sanitizeSearchQuery(search);
      query.$or = [
        { name: { $regex: sanitized, $options: "i" } },
        { productId: { $regex: sanitized, $options: "i" } },
        { category: { $regex: sanitized, $options: "i" } },
      ];
    }
    if (category) query.category = category;

    const skip = (page - 1) * limit;
    const [rawProducts, total] = await Promise.all([
      Product.find(query).skip(skip).limit(limit).lean(),
      Product.countDocuments(query),
    ]);

    const products = sortProductsForCatalog(rawProducts);

    const enriched = products.map((p) => {
      if (isKgProduct(p)) {
        return {
          ...p,
          stockStatus: getStockStatus(p.currentStock, p.minimumStock),
          boxes: 0,
          loosePieces: 0,
          piecePrice: p.sellingPrice,
          displayName: formatProductOptionLabel(p),
          stockSummary: formatKgQty(p.currentStock),
        };
      }
      const ppb = p.piecesPerBox || 1;
      const stock = getStockSplit(p.currentStock, ppb);
      const rates = formatProductCatalogRates(p.sellingPrice, ppb);
      return {
        ...p,
        stockStatus: getStockStatus(p.currentStock, p.minimumStock),
        boxes: stock.fullBoxes,
        loosePieces: stock.loosePieces,
        piecePrice: rates.piecePrice,
        displayName: formatProductOptionLabel(p),
      };
    });

    return apiSuccess({
      products: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();

    const productId = parsed.data.productId.trim();

    const { stockUnit, currentStock: stockQty, ...productData } = parsed.data;
    let currentStock = 0;
    if (stockQty !== undefined && stockQty > 0) {
      currentStock = stockInputToStorage(
        stockQty,
        stockUnit ?? "pieces",
        productData.piecesPerBox,
        productData.sellingUnit
      );
    }

    const product = await Product.create({
      ...productData,
      productId,
      unit: productData.sellingUnit === "kg" ? "Kg" : productData.unit,
      currentStock,
    });

    if (currentStock > 0) {
      await InventoryTransaction.create({
        productId: product._id,
        productName: product.name,
        productCode: product.productId,
        type: "STOCK_IN",
        quantity: currentStock,
        pieces: currentStock,
        boxes: Math.floor(currentStock / (product.piecesPerBox || 1)),
        previousStock: 0,
        newStock: currentStock,
        notes: "Initial stock on product create",
        createdBy: auth.user.id,
        createdByName: auth.user.name,
      });
    }

    await logActivity(
      auth.user,
      "Product Created",
      `Created product ${product.name} (${productId})`,
      productId,
      "product"
    );

    return apiSuccess({ product }, 201);
  } catch (error) {
    return apiError(error);
  }
}
