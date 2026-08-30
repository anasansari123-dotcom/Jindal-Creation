import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { stockInBatchSchema } from "@/lib/validations";
import { processStockInBatch } from "@/lib/services/inventory";
import { logActivity } from "@/lib/activity";
import { getStockSplit } from "@/lib/bill-pricing";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory");
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const parsed = stockInBatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();
    const { productId, deliveries, notes } = parsed.data;

    const result = await processStockInBatch(
      productId,
      deliveries,
      auth.user,
      notes
    );

    const product = await Product.findById(productId).lean();
    if (!product) return apiError("Product not found", 404);

    const stock = getStockSplit(product.currentStock, product.piecesPerBox || 1);

    await logActivity(
      auth.user,
      "Stock Added",
      `${result.entries} delivery entries, +${result.addedPieces} pcs — ${product.name}`,
      product.productId,
      "inventory"
    );

    return apiSuccess({
      message: `${result.entries} delivery entries saved`,
      addedPieces: result.addedPieces,
      entries: result.entries,
      product: {
        ...product,
        boxes: stock.fullBoxes,
        loosePieces: stock.loosePieces,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
