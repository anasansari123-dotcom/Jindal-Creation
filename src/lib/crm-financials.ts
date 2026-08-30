import {
  collectCustomerBills,
  getCustomerPaymentStats,
  type CustomerBillEntry,
} from "@/lib/customer-bills";

export function getFulfillmentLabel(billStatus: "DISPATCH" | "FINAL") {
  return billStatus === "FINAL" ? "Final Bill" : "Dispatch Bill";
}

export function mapOrderToBillInput(o: {
  _id: { toString(): string };
  orderId: string;
  orderDate: Date | string;
  total: number;
  advance: number;
  pending: number;
  paidAmount?: number;
  paymentStatus: string;
}) {
  return {
    _id: o._id,
    orderId: o.orderId,
    orderDate: o.orderDate,
    total: o.total,
    advance: o.advance,
    pending: o.pending,
    paidAmount: o.paidAmount,
    paymentStatus: o.paymentStatus,
  };
}

export function mapDispatchToBillInput(d: {
  _id: { toString(): string };
  dispatchId: string;
  finalBillId?: string;
  billStatus: "DISPATCH" | "FINAL";
  orderId?: { toString(): string };
  dispatchDate: Date | string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
}) {
  return {
    _id: d._id,
    dispatchId: d.dispatchId,
    finalBillId: d.finalBillId,
    billStatus: d.billStatus,
    orderId: d.orderId,
    dispatchDate: d.dispatchDate,
    total: d.total,
    advance: d.advance,
    pending: d.pending,
    paymentStatus: d.paymentStatus,
  };
}

export function mapConfirmToBillInput(cb: {
  _id: { toString(): string };
  confirmBillId: string;
  orderId: { toString(): string };
  confirmDate: Date | string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
}) {
  return {
    _id: cb._id,
    confirmBillId: cb.confirmBillId,
    orderId: cb.orderId,
    confirmDate: cb.confirmDate,
    total: cb.total,
    advance: cb.advance,
    pending: cb.pending,
    paymentStatus: cb.paymentStatus,
  };
}

export function groupBillDocsByCustomer<
  T extends { customerId?: { toString(): string } },
  D extends { customerId?: { toString(): string } },
  C extends { customerId: { toString(): string } },
>(orders: T[], dispatches: D[], confirmBills: C[]) {
  const ordersByCustomer: Record<string, T[]> = {};
  for (const o of orders) {
    const cid = (o as { customerId: { toString(): string } }).customerId.toString();
    if (!ordersByCustomer[cid]) ordersByCustomer[cid] = [];
    ordersByCustomer[cid].push(o);
  }

  const dispatchesByCustomer: Record<string, D[]> = {};
  for (const d of dispatches) {
    const cid = d.customerId?.toString();
    if (!cid) continue;
    if (!dispatchesByCustomer[cid]) dispatchesByCustomer[cid] = [];
    dispatchesByCustomer[cid].push(d);
  }

  const confirmByCustomer: Record<string, C[]> = {};
  for (const cb of confirmBills) {
    const cid = cb.customerId.toString();
    if (!confirmByCustomer[cid]) confirmByCustomer[cid] = [];
    confirmByCustomer[cid].push(cb);
  }

  return { ordersByCustomer, dispatchesByCustomer, confirmByCustomer };
}

export function getBillsForCustomer(
  customerId: string,
  ordersByCustomer: Record<string, Array<Parameters<typeof mapOrderToBillInput>[0]>>,
  dispatchesByCustomer: Record<string, Array<Parameters<typeof mapDispatchToBillInput>[0]>>,
  confirmByCustomer: Record<string, Array<Parameters<typeof mapConfirmToBillInput>[0]>>
): CustomerBillEntry[] {
  return collectCustomerBills(
    (ordersByCustomer[customerId] || []).map(mapOrderToBillInput),
    (dispatchesByCustomer[customerId] || []).map(mapDispatchToBillInput),
    (confirmByCustomer[customerId] || []).map(mapConfirmToBillInput)
  );
}

export interface PortfolioStats {
  totalPending: number;
  totalAdvance: number;
  totalPurchase: number;
  totalPaid: number;
  paidClients: number;
  pendingClients: number;
  advanceClients: number;
}

/** CRM-wide customer totals — same logic as Customers & Payments pages */
export function aggregatePortfolioStats(
  customers: Array<{
    _id: { toString(): string };
    creditBalance?: number;
  }>,
  ordersByCustomer: Record<string, Array<Parameters<typeof mapOrderToBillInput>[0]>>,
  dispatchesByCustomer: Record<string, Array<Parameters<typeof mapDispatchToBillInput>[0]>>,
  confirmByCustomer: Record<string, Array<Parameters<typeof mapConfirmToBillInput>[0]>>
): PortfolioStats {
  let totalPending = 0;
  let totalAdvance = 0;
  let totalPurchase = 0;
  let totalPaid = 0;
  let paidClients = 0;
  let pendingClients = 0;
  let advanceClients = 0;

  for (const customer of customers) {
    const cid = customer._id.toString();
    const bills = getBillsForCustomer(
      cid,
      ordersByCustomer,
      dispatchesByCustomer,
      confirmByCustomer
    );
    const stats = getCustomerPaymentStats(bills, customer.creditBalance || 0);

    totalPending += stats.totalPending;
    totalAdvance += stats.creditBalance;
    totalPurchase += stats.totalPurchase;
    totalPaid += stats.totalAdvance;

    if (stats.paymentStatus === "Fully Paid") paidClients += 1;
    else if (stats.paymentStatus === "Pending") pendingClients += 1;
    else if (stats.paymentStatus === "Advance") advanceClients += 1;
  }

  return {
    totalPending,
    totalAdvance,
    totalPurchase,
    totalPaid,
    paidClients,
    pendingClients,
    advanceClients,
  };
}
