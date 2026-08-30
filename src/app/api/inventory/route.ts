import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product, InventoryTransaction } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { stockAdjustmentSchema } from "@/lib/validations";
import { adjustStock, piecesFromStockInput } from "@/lib/services/inventory";
import { logActivity } from "@/lib/activity";
import { getStockStatus, sanitizeSearchQuery } from "@/lib/utils";
import { getStockSplit } from "@/lib/bill-pricing";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("inventory");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: Record<string, unknown> = { status: "active" };
    if (search) {
      const sanitized = sanitizeSearchQuery(search);
      query.$or = [
        { name: { $regex: sanitized, $options: "i" } },
        { productId: { $regex: sanitized, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const exportAll = searchParams.get("export") === "1";

    const products = exportAll
      ? await Product.find(query).sort({ category: 1, name: 1 }).lean()
      : await Product.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean();
    const total = await Product.countDocuments(query);

    let enriched = products.map((p) => {
      const stock = getStockSplit(p.currentStock, p.piecesPerBox || 1);
      return {
        ...p,
        stockStatus: getStockStatus(p.currentStock, p.minimumStock),
        boxes: stock.fullBoxes,
        loosePieces: stock.loosePieces,
      };
    });

    if (status) {
      enriched = enriched.filter((p) => p.stockStatus === status);
    }

    if (exportAll) {
      return apiSuccess({
        inventory: enriched,
        exportedAt: new Date().toISOString(),
        total: enriched.length,
      });
    }

    return apiSuccess({
      inventory: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory");
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const parsed = stockAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();

    let quantityInPieces = parsed.data.quantity;
    if (parsed.data.type !== "ADJUSTMENT") {
      const product = await Product.findById(parsed.data.productId);
      if (!product) return apiError("Product not found", 404);
      quantityInPieces = piecesFromStockInput(
        parsed.data.quantity,
        parsed.data.stockUnit || "pieces",
        product.piecesPerBox || 1
      );
    }

    await adjustStock(
      parsed.data.productId,
      parsed.data.type,
      parsed.data.type === "ADJUSTMENT" ? parsed.data.quantity : quantityInPieces,
      auth.user,
      { notes: parsed.data.notes }
    );

    const action = parsed.data.type === "STOCK_IN" ? "Stock Added" : "Stock Adjusted";
    await logActivity(
      auth.user,
      action,
      `${parsed.data.type}: ${parsed.data.quantity} units`,
      parsed.data.productId,
      "inventory"
    );

    const product = await Product.findById(parsed.data.productId).lean();
    return apiSuccess({ product, message: "Stock updated successfully" });
  } catch (error) {
    return apiError(error);
  }
}
