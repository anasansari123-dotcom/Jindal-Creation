import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product, Order, Dispatch, ConfirmBill, InventoryTransaction } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import {
  buildProductHistory,
  summarizeProductHistory,
  enrichHistoryWithOversales,
} from "@/lib/product-history";
import { formatProductStock } from "@/lib/product-units";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("products");
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await connectDB();

    const product = await Product.findById(id).lean();
    if (!product) return apiError("Product not found", 404);

    const [orders, dispatches, confirmBills] = await Promise.all([
      Order.find({ "items.productId": product._id }).lean(),
      Dispatch.find({ "items.productId": product._id }).lean(),
      ConfirmBill.find({ "items.productId": product._id }).lean(),
    ]);

    // Also match by productCode for legacy records
    const [ordersByCode, dispatchesByCode, confirmsByCode] = await Promise.all([
      Order.find({ "items.productCode": product.productId }).lean(),
      Dispatch.find({ "items.productCode": product.productId }).lean(),
      ConfirmBill.find({ "items.productCode": product.productId }).lean(),
    ]);

    const mergeUnique = <T extends { _id: { toString(): string } }>(a: T[], b: T[]) => {
      const map = new Map<string, T>();
      [...a, ...b].forEach((doc) => map.set(doc._id.toString(), doc));
      return [...map.values()];
    };

    const allOrders = mergeUnique(orders, ordersByCode);
    const allDispatches = mergeUnique(dispatches, dispatchesByCode);
    const allConfirms = mergeUnique(confirmBills, confirmsByCode);

    const history = enrichHistoryWithOversales(
      buildProductHistory(
        product._id.toString(),
        product.productId,
        allOrders.map((o) => ({
          _id: o._id,
          orderId: o.orderId,
          orderDate: o.orderDate,
          customerId: o.customerId,
          customerName: o.customerName,
          customerCode: o.customerCode,
          items: o.items,
        })),
        allDispatches.map((d) => ({
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
        })),
        allConfirms.map((cb) => ({
          _id: cb._id,
          confirmBillId: cb.confirmBillId,
          orderId: cb.orderId,
          confirmDate: cb.confirmDate,
          customerId: cb.customerId,
          customerName: cb.customerName,
          customerCode: cb.customerCode,
          items: cb.items,
        }))
      ),
      await InventoryTransaction.find({
        productId: product._id,
        soldWithoutPurchase: true,
      })
        .select("orderId shortfallQty soldWithoutPurchase")
        .lean()
    );

    return apiSuccess({
      product: {
        _id: product._id.toString(),
        productId: product.productId,
        name: product.name,
        category: product.category,
        piecesPerBox: product.piecesPerBox,
        sellingUnit: product.sellingUnit,
        unit: product.unit,
        currentStock: product.currentStock,
        stockDisplay: formatProductStock({
          currentStock: product.currentStock,
          piecesPerBox: product.piecesPerBox || 1,
          sellingUnit: product.sellingUnit,
          unit: product.unit,
        }),
      },
      history,
      summary: summarizeProductHistory(history, product.currentStock),
    });
  } catch (error) {
    return apiError(error);
  }
}
