import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product, Order, Dispatch, ConfirmBill, InventoryTransaction } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { sanitizeSearchQuery } from "@/lib/utils";
import {
  buildProductHistory,
  summarizeProductHistory,
  enrichHistoryWithOversales,
} from "@/lib/product-history";
import { formatProductStock } from "@/lib/product-units";

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
    if (products.length === 0) {
      return apiSuccess({ products: [] });
    }

    const productIds = products.map((p) => p._id);
    const productCodes = products.map((p) => p.productId);
    const billItemFilter = {
      $or: [
        { "items.productId": { $in: productIds } },
        { "items.productCode": { $in: productCodes } },
      ],
    };
    const billFields =
      "orderId orderDate customerId customerName customerCode items dispatchId finalBillId billStatus dispatchDate confirmBillId confirmDate";

    const [orders, dispatches, confirmBills] = await Promise.all([
      Order.find(billItemFilter).select(billFields).lean(),
      Dispatch.find(billItemFilter).select(billFields).lean(),
      ConfirmBill.find(billItemFilter).select(billFields).lean(),
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

    const oversaleTxs = await InventoryTransaction.find({
      productId: { $in: productIds },
      soldWithoutPurchase: true,
    })
      .select("productId orderId shortfallQty soldWithoutPurchase")
      .lean();

    const oversalesByProduct = new Map<string, typeof oversaleTxs>();
    for (const tx of oversaleTxs) {
      const pid = tx.productId.toString();
      const list = oversalesByProduct.get(pid) || [];
      list.push(tx);
      oversalesByProduct.set(pid, list);
    }

    const productsWithHistory = products.map((p) => {
      const pid = p._id.toString();
      const history = enrichHistoryWithOversales(
        buildProductHistory(
          pid,
          p.productId,
          orderDocs,
          dispatchDocs,
          confirmDocs
        ),
        oversalesByProduct.get(pid) || []
      );
      const summary = summarizeProductHistory(history, p.currentStock);
      return {
        _id: pid,
        productId: p.productId,
        name: p.name,
        category: p.category,
        piecesPerBox: p.piecesPerBox,
        sellingUnit: p.sellingUnit,
        unit: p.unit,
        currentStock: p.currentStock,
        stockDisplay: formatProductStock({
          currentStock: p.currentStock,
          piecesPerBox: p.piecesPerBox || 1,
          sellingUnit: p.sellingUnit,
          unit: p.unit,
        }),
        ...summary,
      };
    });

    return apiSuccess({ products: productsWithHistory });
  } catch (error) {
    return apiError(error);
  }
}
