import type { BillPaymentRow, PaymentSummary } from "@/lib/payment-ledger";

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
  linkPath?: string;
}

interface OrderDoc {
  _id: { toString(): string };
  orderId: string;
  orderDate: Date | string;
  total: number;
  advance: number;
  pending: number;
  paidAmount?: number;
  paymentStatus: string;
}

interface DispatchDoc {
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
}

interface ConfirmBillDoc {
  _id: { toString(): string };
  confirmBillId: string;
  orderId: { toString(): string };
  confirmDate: Date | string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
}

/** Collect all bills for a customer without double-counting linked order/dispatch/confirm */
export function collectCustomerBills(
  orders: OrderDoc[],
  dispatches: DispatchDoc[],
  confirmBills: ConfirmBillDoc[]
): CustomerBillEntry[] {
  const bills: CustomerBillEntry[] = [];
  const coveredOrderIds = new Set<string>();

  for (const cb of confirmBills) {
    const oid = cb.orderId.toString();
    coveredOrderIds.add(oid);
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
      linkPath: undefined,
    });
  }

  for (const d of dispatches) {
    if (d.orderId) {
      const oid = d.orderId.toString();
      if (coveredOrderIds.has(oid)) continue;
      coveredOrderIds.add(oid);
    }
    bills.push({
      refId: d._id.toString(),
      billId: d.billStatus === "FINAL" && d.finalBillId ? d.finalBillId : d.dispatchId,
      billType: d.billStatus === "FINAL" ? "Final" : "Dispatch",
      billSource: "Dispatch",
      date: d.dispatchDate,
      total: d.total,
      paid: d.advance,
      pending: d.pending,
      paymentStatus: d.paymentStatus,
      linkPath: `/admin/dispatch/${d._id.toString()}`,
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
      linkPath: `/admin/orders/${oid}`,
    });
  }

  // Skip Confirm if same ID exists as Final dispatch (avoid double count)
  const finalBillIds = new Set(
    dispatches
      .filter((d) => d.billStatus === "FINAL")
      .map((d) => d.finalBillId || d.dispatchId)
  );
  const deduped = bills.filter(
    (b) => !(b.billType === "Confirm" && finalBillIds.has(b.billId))
  );

  return deduped.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/** Preview FIFO allocation before saving payment */
export function previewPaymentAllocation(
  bills: CustomerBillEntry[],
  amount: number
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
  const totalPendingAfter = Math.max(
    0,
    bills.reduce((s, b) => s + b.pending, 0) - amount + creditAdded
  );

  return { allocations, creditAdded, totalPendingAfter };
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

  return {
    totalBillAmount,
    totalClientPaid,
    totalPending: adjusted.totalPending,
    totalOrders: bills.length,
    creditBalance: adjusted.creditBalance,
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
    totalAdvance: ledger.totalClientPaid,
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
