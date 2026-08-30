import { Order, Dispatch, ConfirmBill } from "@/lib/models";
import type { Types } from "mongoose";
import {
  collectCustomerBills,
  customerNamesMatch,
  mapConfirmBillsForCollect,
  mapDispatchesForCollect,
  mapOrdersForCollect,
  type ConfirmBillDoc,
  type CustomerBillEntry,
  type DispatchDoc,
  type OrderDoc,
} from "@/lib/customer-bills";

/** Load all bill documents for one customer (includes order-linked dispatch/confirm) */
export async function loadCustomerBillDocuments(customerId: string) {
  const orders = await Order.find({ customerId }).sort({ orderDate: 1 }).lean();
  const orderIds = orders.map((o) => o._id);
  const [dispatches, confirmBills] = await Promise.all([
    Dispatch.find({
      $or: [{ customerId }, { orderId: { $in: orderIds } }],
    })
      .sort({ dispatchDate: 1 })
      .lean(),
    ConfirmBill.find({
      $or: [{ customerId }, { orderId: { $in: orderIds } }],
    })
      .sort({ confirmDate: 1 })
      .lean(),
  ]);
  return { orders, dispatches, confirmBills };
}

/** Batch load for customers list / portfolio */
export async function loadCustomerBillDocumentsBatch(customerIds: Types.ObjectId[]) {
  if (customerIds.length === 0) {
    return { orders: [], dispatches: [], confirmBills: [] };
  }
  const orders = await Order.find({ customerId: { $in: customerIds } }).lean();
  const orderIds = orders.map((o) => o._id);
  const [dispatches, confirmBills] = await Promise.all([
    Dispatch.find({
      $or: [
        { customerId: { $in: customerIds } },
        { orderId: { $in: orderIds } },
      ],
    }).lean(),
    ConfirmBill.find({
      $or: [
        { customerId: { $in: customerIds } },
        { orderId: { $in: orderIds } },
      ],
    }).lean(),
  ]);
  return { orders, dispatches, confirmBills };
}

export async function getCustomerBills(customerId: string): Promise<CustomerBillEntry[]> {
  const { orders, dispatches, confirmBills } = await loadCustomerBillDocuments(customerId);
  return collectCustomerBills(
    mapOrdersForCollect(orders as OrderDoc[]),
    mapDispatchesForCollect(dispatches as DispatchDoc[]),
    mapConfirmBillsForCollect(confirmBills as ConfirmBillDoc[])
  );
}

/** Bills for one customer — matched by customerId AND bill customerName */
export async function getCustomerBillsForRecord(
  customerId: string,
  customerName: string
): Promise<CustomerBillEntry[]> {
  const all = await getCustomerBills(customerId);
  return all.filter((b) => customerNamesMatch(b.customerName, customerName));
}

/** Group batch docs — only count dispatches whose name matches linked customer */
export function dispatchesForCustomerInBatch<
  T extends {
    customerId?: { toString(): string };
    customerName?: string;
  },
>(customerId: string, customerName: string, dispatches: T[]) {
  return dispatches.filter(
    (d) =>
      d.customerId?.toString() === customerId &&
      customerNamesMatch(d.customerName, customerName)
  );
}
