/** Shared bill total math — client & server safe (no DB) */

export interface DispatchBillTotalsInput {
  subtotal: number;
  discount: number;
  carriedForwardPending?: number;
  cashPaid?: number;
  creditApplied?: number;
}

export interface DispatchBillTotalsResult {
  subtotal: number;
  discount: number;
  currentBillAmount: number;
  carriedForwardPending: number;
  total: number;
  cashPaid: number;
  creditApplied: number;
  /** Total paid toward bill (cash + account credit used) */
  totalPaid: number;
  /** Amount applied on this bill (capped at total) */
  billPaid: number;
  /** Stored on bill as advance */
  advance: number;
  pending: number;
  /** Excess payment → customer account advance/credit */
  creditAdded: number;
}

export function computeDispatchBillTotals(
  input: DispatchBillTotalsInput
): DispatchBillTotalsResult {
  const subtotal = Math.max(0, input.subtotal);
  const discount = Math.max(0, input.discount || 0);
  const carriedForwardPending = Math.max(0, input.carriedForwardPending || 0);
  const cashPaid = Math.max(0, input.cashPaid || 0);
  const creditApplied = Math.max(0, input.creditApplied || 0);

  const currentBillAmount = Math.max(0, subtotal - discount);
  const total = currentBillAmount + carriedForwardPending;
  const totalPaid = cashPaid + creditApplied;
  const billPaid = Math.min(totalPaid, total);
  const pending = Math.max(0, total - totalPaid);
  const creditAdded = Math.max(0, totalPaid - total);

  return {
    subtotal,
    discount,
    currentBillAmount,
    carriedForwardPending,
    total,
    cashPaid,
    creditApplied,
    totalPaid,
    billPaid,
    advance: billPaid,
    pending,
    creditAdded,
  };
}

export function previewCreditApplication(
  grossTotal: number,
  cashPaid: number,
  creditBalance: number
) {
  const room = Math.max(0, grossTotal - cashPaid);
  const creditApplied = Math.min(Math.max(0, creditBalance), room);
  return { creditApplied, remainingCredit: Math.max(0, creditBalance - creditApplied) };
}
