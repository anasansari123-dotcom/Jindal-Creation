import type { BillPaymentRow, PaymentSummary } from "@/lib/payment-ledger";
import { getBillPaymentDisplay } from "@/lib/bill-payment-display";

export type BillSource = "Order" | "Dispatch" | "ConfirmBill";
export type BillDisplayType = "Order" | "Dispatch" | "Final" | "Confirm";

export interface CustomerBillEntry {
  refId: string;
  billId: string;
  billType: BillDisplayType;
  billSource: BillSource;
  date: Date | string;
  total: number;
  paid: number;
  pending: number;
  paymentStatus: string;
  customerName: string;
  dispatchId?: string;
  linkPath?: string;
}

export interface OrderDoc {
  _id: { toString(): string };
  orderId: string;
  orderDate: Date | string;
  customerName?: string;
  total: number;
  advance: number;
  pending: number;
  paidAmount?: number;
  paymentStatus: string;
}

export interface DispatchDoc {
  _id: { toString(): string };
  dispatchId: string;
  finalBillId?: string;
  billStatus: "DISPATCH" | "FINAL";
  orderId?: { toString(): string };
  dispatchDate: Date | string;
  customerName?: string;
  total: number;
  advance: number;
  pending: number;
  cashPaid?: number;
  creditAdded?: number;
  creditApplied?: number;
  paymentStatus: string;
}

export interface ConfirmBillDoc {
  _id: { toString(): string };
  confirmBillId: string;
  orderId: { toString(): string };
  confirmDate: Date | string;
  customerName?: string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
}

export function normalizeCustomerName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function customerNamesMatch(a: string | undefined, b: string | undefined) {
  if (!a?.trim() || !b?.trim()) return false;
  return normalizeCustomerName(a) === normalizeCustomerName(b);
}

export function mapOrdersForCollect(orders: OrderDoc[]) {
  return orders.map((o) => ({
    _id: o._id,
    orderId: o.orderId,
    orderDate: o.orderDate,
    customerName: o.customerName,
    total: o.total,
    advance: o.advance,
    pending: o.pending,
    paidAmount: o.paidAmount,
    paymentStatus: o.paymentStatus,
  }));
}

export function mapDispatchesForCollect(dispatches: DispatchDoc[]) {
  return dispatches.map((d) => ({
    _id: d._id,
    dispatchId: d.dispatchId,
    finalBillId: d.finalBillId,
    billStatus: d.billStatus,
    orderId: d.orderId,
    dispatchDate: d.dispatchDate,
    customerName: d.customerName,
    total: d.total,
    advance: d.advance,
    pending: d.pending,
    cashPaid: d.cashPaid,
    creditAdded: d.creditAdded,
    creditApplied: d.creditApplied,
    paymentStatus: d.paymentStatus,
  }));
}

export function mapConfirmBillsForCollect(confirmBills: ConfirmBillDoc[]) {
  return confirmBills.map((cb) => ({
    _id: cb._id,
    confirmBillId: cb.confirmBillId,
    orderId: cb.orderId,
    confirmDate: cb.confirmDate,
    customerName: cb.customerName,
    total: cb.total,
    advance: cb.advance,
    pending: cb.pending,
    paymentStatus: cb.paymentStatus,
  }));
}

/** Collect all bills for a customer — Dispatch is source of truth; no double-count */
export function collectCustomerBills(
  orders: OrderDoc[],
  dispatches: DispatchDoc[],
  confirmBills: ConfirmBillDoc[]
): CustomerBillEntry[] {
  const bills: CustomerBillEntry[] = [];
  const coveredOrderIds = new Set<string>();
  const finalBillIds = new Set(
    dispatches
      .filter((d) => d.billStatus === "FINAL")
      .map((d) => d.finalBillId || d.dispatchId)
  );

  for (const d of dispatches) {
    if (d.orderId) coveredOrderIds.add(d.orderId.toString());
    const refId = d._id.toString();
    const payment = getBillPaymentDisplay(d);
    bills.push({
      refId,
      billId: d.billStatus === "FINAL" && d.finalBillId ? d.finalBillId : d.dispatchId,
      billType: d.billStatus === "FINAL" ? "Final" : "Dispatch",
      billSource: "Dispatch",
      date: d.dispatchDate,
      total: d.total,
      paid: payment.cashPaid,
      pending: payment.pending,
      paymentStatus: d.paymentStatus,
      customerName: d.customerName || "—",
      dispatchId: d.dispatchId,
      linkPath: `/admin/dispatch/${refId}`,
    });
  }

  for (const o of orders) {
    const oid = o._id.toString();
    if (coveredOrderIds.has(oid)) continue;
    bills.push({
      refId: oid,
      billId: o.orderId,
      billType: "Order",
      billSource: "Order",
      date: o.orderDate,
      total: o.total,
      paid: o.paidAmount ?? o.advance,
      pending: o.pending,
      paymentStatus: o.paymentStatus,
      customerName: o.customerName || "—",
      linkPath: `/admin/orders/${oid}`,
    });
  }

  for (const cb of confirmBills) {
    if (finalBillIds.has(cb.confirmBillId)) continue;
    const oid = cb.orderId.toString();
    if (coveredOrderIds.has(oid)) continue;
    bills.push({
      refId: cb._id.toString(),
      billId: cb.confirmBillId,
      billType: "Confirm",
      billSource: "ConfirmBill",
      date: cb.confirmDate,
      total: cb.total,
      paid: cb.advance,
      pending: cb.pending,
      paymentStatus: cb.paymentStatus,
      customerName: cb.customerName || "—",
      linkPath: undefined,
    });
  }

  return bills.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/** Keep only bills whose stored name matches this customer record */
export function filterBillsForCustomerRecord(
  bills: CustomerBillEntry[],
  customerName: string
) {
  return bills.filter((b) => customerNamesMatch(b.customerName, customerName));
}

/** Preview FIFO allocation before saving payment */
export function previewPaymentAllocation(
  bills: CustomerBillEntry[],
  amount: number,
  creditBalance = 0
) {
  let remaining = amount;
  const allocations: Array<{
    billId: string;
    billType: BillDisplayType;
    amount: number;
    pendingAfter: number;
  }> = [];

  for (const bill of bills) {
    if (remaining <= 0) break;
    if (bill.pending <= 0) continue;

    const apply = Math.min(remaining, bill.pending);
    const pendingAfter = bill.pending - apply;

    allocations.push({
      billId: bill.billId,
      billType: bill.billType,
      amount: apply,
      pendingAfter,
    });
    remaining -= apply;
  }

  const creditAdded = remaining;
  const rawPendingAfter = Math.max(
    0,
    bills.reduce((s, b) => s + b.pending, 0) - amount + creditAdded
  );
  const adjusted = applyCreditAgainstPending(rawPendingAfter, creditBalance);

  return {
    allocations,
    creditAdded,
    totalPendingAfter: adjusted.totalPending,
  };
}

/** Pehle account advance se bill pending adjust — baaki hi pending/credit dikhao */
export function applyCreditAgainstPending(
  billPending: number,
  accountCredit: number
) {
  const creditAppliedToPending = Math.min(accountCredit, billPending);
  return {
    totalPending: billPending - creditAppliedToPending,
    creditBalance: accountCredit - creditAppliedToPending,
    creditAppliedToPending,
  };
}

export function buildCustomerBillLedger(
  bills: CustomerBillEntry[],
  creditBalance = 0
): PaymentSummary {
  let cumulativeBillTotal = 0;
  let cumulativeClientPaid = 0;
  let cumulativePending = 0;

  const ledger: BillPaymentRow[] = bills.map((bill) => {
    cumulativeBillTotal += bill.total;
    cumulativeClientPaid += bill.paid;
    cumulativePending += bill.pending;

    return {
      date: bill.date,
      billId: bill.billId,
      billType: bill.billType,
      customerName: bill.customerName,
      billAmount: bill.total,
      clientPaid: bill.paid,
      pending: bill.pending,
      paymentStatus: bill.paymentStatus,
      orderId: bill.linkPath?.includes("/orders/") ? bill.refId : undefined,
      dispatchId: bill.billSource === "Dispatch" ? bill.refId : undefined,
      linkPath: bill.linkPath,
      cumulativeBillTotal,
      cumulativeClientPaid,
      cumulativePending,
    };
  });

  const totalBillAmount = bills.reduce((s, b) => s + b.total, 0);
  const totalClientPaid = bills.reduce((s, b) => s + b.paid, 0);
  const rawPending = bills.reduce((s, b) => s + b.pending, 0);
  const adjusted = applyCreditAgainstPending(rawPending, creditBalance);

  const totalAppliedToBills = Math.max(0, totalBillAmount - adjusted.totalPending);

  // Bills with cashPaid already include overpayment — don't add stored credit again
  const totalCashPaid =
    totalClientPaid > totalAppliedToBills
      ? totalClientPaid
      : totalAppliedToBills + adjusted.creditBalance;

  const displayAdvance = Math.max(0, totalCashPaid - totalAppliedToBills);

  return {
    totalBillAmount,
    totalClientPaid,
    totalCashPaid,
    totalAppliedToBills,
    totalPending: adjusted.totalPending,
    totalOrders: bills.length,
    creditBalance: displayAdvance,
    creditAppliedToPending: adjusted.creditAppliedToPending,
    isFullyPaid: totalBillAmount > 0 && adjusted.totalPending <= 0,
    hasPending: adjusted.totalPending > 0,
    ledger,
  };
}

export function getCustomerPaymentStats(
  bills: CustomerBillEntry[],
  creditBalance = 0
) {
  const ledger = buildCustomerBillLedger(bills, creditBalance);

  return {
    totalPurchase: ledger.totalBillAmount,
    totalAdvance: ledger.totalAppliedToBills,
    totalAppliedToBills: ledger.totalAppliedToBills,
    totalCashPaid: ledger.totalCashPaid,
    totalPending: ledger.totalPending,
    creditBalance: ledger.creditBalance,
    creditAppliedToPending: ledger.creditAppliedToPending ?? 0,
    paymentStatus:
      ledger.totalOrders === 0
        ? "No Bills"
        : ledger.hasPending
          ? "Pending"
          : ledger.creditBalance > 0
            ? "Advance"
            : "Fully Paid",
    isFullyPaid: ledger.isFullyPaid,
    hasPending: ledger.hasPending,
  };
}
