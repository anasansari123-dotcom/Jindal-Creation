import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth/session";
import { quickProductSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { getStockSplit, formatProductCatalogRates } from "@/lib/bill-pricing";
import { getStockStatus } from "@/lib/utils";
import { isKgProduct, formatKgQty } from "@/lib/product-units";
import { formatProductOptionLabel, PRODUCT_NAME_DUPLICATE_MESSAGE, productNameDuplicateQuery } from "@/lib/product-display";

/** Quick product create from bill page (Tally-style) — stock starts at 0 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  if (
    !hasPermission(auth.user, "products") &&
    !hasPermission(auth.user, "dispatch")
  ) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = quickProductSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();

    const name = parsed.data.name;
    const duplicate = await Product.findOne(productNameDuplicateQuery(name));
    if (duplicate) {
      return apiError(PRODUCT_NAME_DUPLICATE_MESSAGE, 400);
    }

    const productId = parsed.data.productId.trim();

    const sellingUnit = parsed.data.sellingUnit;
    const product = await Product.create({
      productId,
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      unit: sellingUnit === "kg" ? "Kg" : sellingUnit === "piece" ? "Piece" : "Box",
      sellingUnit,
      price: parsed.data.sellingPrice,
      costPrice: 0,
      sellingPrice: parsed.data.sellingPrice,
      piecesPerBox: sellingUnit === "kg" ? 1 : parsed.data.piecesPerBox,
      minimumStock: 10,
      currentStock: 0,
      status: "active",
    });

    await logActivity(
      auth.user,
      "Product Created",
      `Quick create from bill: ${product.name} (${productId}) — stock 0`,
      productId,
      "product"
    );

    const ppb = product.piecesPerBox || 1;
    const stock = getStockSplit(product.currentStock, ppb);
    const rates = formatProductCatalogRates(product.sellingPrice, ppb);

    return apiSuccess(
      {
        product: {
          ...product.toObject(),
          stockStatus: getStockStatus(product.currentStock, product.minimumStock),
          boxes: stock.fullBoxes,
          loosePieces: stock.loosePieces,
          piecePrice: rates.piecePrice,
          displayName: formatProductOptionLabel(product),
          stockSummary: isKgProduct(product)
            ? formatKgQty(product.currentStock)
            : undefined,
        },
      },
      201
    );
  } catch (error) {
    return apiError(error);
  }
}
