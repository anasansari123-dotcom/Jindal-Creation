import { formatCurrency } from "@/lib/utils";

export interface BillPaymentFields {
  total: number;
  advance: number;
  pending: number;
  cashPaid?: number;
  creditAdded?: number;
  creditApplied?: number;
  subtotal?: number;
  discount?: number;
  currentBillAmount?: number;
  carriedForwardPending?: number;
}

export interface BillPaymentDisplay {
  billAmount: number;
  billPaid: number;
  cashPaid: number;
  pending: number;
  creditAdded: number;
  creditApplied: number;
  hasPending: boolean;
  hasAdvance: boolean;
}

/** Resolve actual customer cash/UPI paid — works for new bills (cashPaid field) and legacy records */
export function resolveBillCashPaid(bill: BillPaymentFields): number {
  if ((bill.cashPaid ?? 0) > 0) {
    return bill.cashPaid!;
  }

  const creditAdded = Math.max(0, bill.creditAdded || 0);
  const creditApplied = Math.max(0, bill.creditApplied || 0);
  const billPaid = Math.max(0, bill.advance || 0);

  // Legacy: advance was sometimes stored as raw cash when customer overpaid
  if (creditAdded === 0 && billPaid > bill.total) {
    return billPaid;
  }

  return Math.max(0, billPaid + creditAdded - creditApplied);
}

export function getBillPaymentDisplay(bill: BillPaymentFields): BillPaymentDisplay {
  const creditApplied = Math.max(0, bill.creditApplied || 0);
  const cashPaid = resolveBillCashPaid(bill);
  const totalPaid = cashPaid + creditApplied;
  const billPaid = Math.min(totalPaid, bill.total);
  const pending = Math.max(0, bill.total - totalPaid);
  const creditAdded = Math.max(0, totalPaid - bill.total);

  return {
    billAmount: bill.total,
    billPaid,
    cashPaid,
    pending,
    creditAdded,
    creditApplied,
    hasPending: pending > 0,
    hasAdvance: creditAdded > 0,
  };
}

export function formatBillAmountBreakdown(bill: BillPaymentFields): string {
  const current =
    bill.currentBillAmount ?? Math.max(0, (bill.subtotal ?? 0) - (bill.discount ?? 0));
  const carried = Math.max(0, bill.carriedForwardPending || 0);

  if (carried > 0) {
    return `Is Bill ${formatCurrency(current)} + Purani Pending ${formatCurrency(carried)} = ${formatCurrency(bill.total)}`;
  }
  if ((bill.discount || 0) > 0) {
    return `Subtotal ${formatCurrency(bill.subtotal ?? 0)} − Discount ${formatCurrency(bill.discount ?? 0)} = ${formatCurrency(bill.total)}`;
  }
  return `Bill Amount ${formatCurrency(bill.total)}`;
}

export function formatBillPaymentFormula(display: BillPaymentDisplay): string {
  if (display.hasPending) {
    return `${formatCurrency(display.billAmount)} − ${formatCurrency(display.cashPaid)} = ${formatCurrency(display.pending)} pending`;
  }
  if (display.hasAdvance) {
    return `${formatCurrency(display.cashPaid)} − ${formatCurrency(display.billAmount)} = ${formatCurrency(display.creditAdded)} advance save`;
  }
  if (display.cashPaid > 0) {
    return `${formatCurrency(display.billAmount)} − ${formatCurrency(display.cashPaid)} = ${formatCurrency(0)}`;
  }
  return `${formatCurrency(display.billAmount)} — unpaid`;
}
