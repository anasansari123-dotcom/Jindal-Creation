import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Dispatch, InventoryTransaction, Product } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { formatInventoryHistoryRow } from "@/lib/inventory-history";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("inventory", request);
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query: Record<string, unknown> = {};
    if (productId) query.productId = productId;

    let piecesPerBox = 1;
    if (productId) {
      const product = await Product.findById(productId).select("piecesPerBox").lean();
      piecesPerBox = product?.piecesPerBox || 1;
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryTransaction.countDocuments(query),
    ]);

    const billRefs = [
      ...new Set(
        transactions.map((tx) => tx.orderId).filter((id): id is string => Boolean(id))
      ),
    ];

    const dispatches = billRefs.length
      ? await Dispatch.find({
          $or: [{ dispatchId: { $in: billRefs } }, { finalBillId: { $in: billRefs } }],
        }).lean()
      : [];

    const dispatchByRef = new Map<string, (typeof dispatches)[number]>();
    for (const dispatch of dispatches) {
      dispatchByRef.set(dispatch.dispatchId, dispatch);
      if (dispatch.finalBillId) dispatchByRef.set(dispatch.finalBillId, dispatch);
    }

    const rows = transactions.map((tx) =>
      formatInventoryHistoryRow(
        tx,
        tx.orderId ? dispatchByRef.get(tx.orderId) : null,
        piecesPerBox
      )
    );

    return apiSuccess({
      transactions: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}
