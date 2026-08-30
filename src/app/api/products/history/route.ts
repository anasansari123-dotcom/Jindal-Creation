import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product, Order, Dispatch, ConfirmBill } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { sanitizeSearchQuery } from "@/lib/utils";
import { buildProductHistory, summarizeProductHistory } from "@/lib/product-history";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const query: Record<string, unknown> = { status: "active" };
    if (search) {
      const sanitized = sanitizeSearchQuery(search);
      query.$or = [
        { name: { $regex: sanitized, $options: "i" } },
        { productId: { $regex: sanitized, $options: "i" } },
        { category: { $regex: sanitized, $options: "i" } },
      ];
    }

    const products = await Product.find(query).sort({ name: 1 }).lean();
    const [orders, dispatches, confirmBills] = await Promise.all([
      Order.find({}).lean(),
      Dispatch.find({}).lean(),
      ConfirmBill.find({}).lean(),
    ]);

    const orderDocs = orders.map((o) => ({
      _id: o._id,
      orderId: o.orderId,
      orderDate: o.orderDate,
      customerId: o.customerId,
      customerName: o.customerName,
      customerCode: o.customerCode,
      items: o.items,
    }));

    const dispatchDocs = dispatches.map((d) => ({
      _id: d._id,
      dispatchId: d.dispatchId,
      finalBillId: d.finalBillId,
      billStatus: d.billStatus,
      orderId: d.orderId,
      customerId: d.customerId,
      customerName: d.customerName,
      customerCode: d.customerCode,
      dispatchDate: d.dispatchDate,
      items: d.items,
    }));

    const confirmDocs = confirmBills.map((cb) => ({
      _id: cb._id,
      confirmBillId: cb.confirmBillId,
      orderId: cb.orderId,
      confirmDate: cb.confirmDate,
      customerId: cb.customerId,
      customerName: cb.customerName,
      customerCode: cb.customerCode,
      items: cb.items,
    }));

    const productsWithHistory = products.map((p) => {
      const history = buildProductHistory(
        p._id.toString(),
        p.productId,
        orderDocs,
        dispatchDocs,
        confirmDocs
      );
      const summary = summarizeProductHistory(history);
      return {
        _id: p._id.toString(),
        productId: p.productId,
        name: p.name,
        category: p.category,
        piecesPerBox: p.piecesPerBox,
        currentStock: p.currentStock,
        ...summary,
      };
    });

    return apiSuccess({ products: productsWithHistory });
  } catch (error) {
    return apiError(error);
  }
}
