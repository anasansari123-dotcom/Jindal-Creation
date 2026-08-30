import { formatCurrency } from "@/lib/utils";

export interface BillPaymentRow {
  date: string | Date;
  billId: string;
  billType: "Order" | "Dispatch" | "Final" | "Confirm";
  customerName?: string;
  billAmount: number;
  clientPaid: number;
  pending: number;
  paymentStatus: string;
  orderId?: string;
  dispatchId?: string;
  linkPath?: string;
  /** Cumulative totals up to and including this bill */
  cumulativeBillTotal: number;
  cumulativeClientPaid: number;
  cumulativePending: number;
}

export interface PaymentSummary {
  totalBillAmount: number;
  /** Sum of per-bill cash (may include overpayment stored on bill) */
  totalClientPaid: number;
  /** Actual total money from customer = applied to bills + advance */
  totalCashPaid: number;
  /** Amount applied toward bills (bill total − pending) */
  totalAppliedToBills: number;
  totalPending: number;
  totalOrders: number;
  /** Advance available (derived: totalCashPaid − totalAppliedToBills) */
  creditBalance: number;
  /** Advance credit used to offset bill pending (display calc) */
  creditAppliedToPending?: number;
  isFullyPaid: boolean;
  hasPending: boolean;
  ledger: BillPaymentRow[];
}

interface OrderLike {
  _id?: string;
  orderId: string;
  orderDate: string | Date;
  total: number;
  advance: number;
  pending: number;
  paidAmount?: number;
  paymentStatus: string;
}

export function buildPaymentLedger(orders: OrderLike[]): PaymentSummary {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
  );

  let cumulativeBillTotal = 0;
  let cumulativeClientPaid = 0;
  let cumulativePending = 0;

  const ledger: BillPaymentRow[] = sorted.map((order) => {
    const billAmount = order.total;
    const clientPaid = order.paidAmount ?? order.advance;
    const pending = order.pending;

    cumulativeBillTotal += billAmount;
    cumulativeClientPaid += clientPaid;
    cumulativePending += pending;

    return {
      date: order.orderDate,
      billId: order.orderId,
      billType: "Order",
      billAmount,
      clientPaid,
      pending,
      paymentStatus: order.paymentStatus,
      orderId: order._id?.toString(),
      cumulativeBillTotal,
      cumulativeClientPaid,
      cumulativePending,
    };
  });

  const totalBillAmount = orders.reduce((s, o) => s + o.total, 0);
  const totalClientPaid = orders.reduce((s, o) => s + (o.paidAmount ?? o.advance), 0);
  const totalPending = orders.reduce((s, o) => s + o.pending, 0);

  return {
    totalBillAmount,
    totalClientPaid,
    totalCashPaid: totalClientPaid,
    totalAppliedToBills: Math.max(0, totalBillAmount - totalPending),
    totalPending,
    totalOrders: orders.length,
    creditBalance: 0,
    isFullyPaid: totalBillAmount > 0 && totalPending <= 0,
    hasPending: totalPending > 0,
    ledger,
  };
}

export function getPaymentStatusLabel(summary: PaymentSummary): string {
  if (summary.totalOrders === 0) return "No Bills";
  if (summary.creditBalance > 0 && !summary.hasPending) {
    return `Advance: ₹${summary.creditBalance.toLocaleString("en-IN")} account me save`;
  }
  if (summary.isFullyPaid && summary.creditBalance <= 0) return "Fully Paid — No Pending";
  if (summary.totalCashPaid > 0 && summary.hasPending) return "Partial Payment — Pending Remaining";
  if (summary.totalCashPaid <= 0) return "Unpaid — Full Amount Pending";
  return "Pending";
}

export function formatPaymentBreakdown(summary: PaymentSummary) {
  return {
    billLabel: `Total Bill Amount: ${formatCurrency(summary.totalBillAmount)}`,
    paidLabel: `Customer Paid: ${formatCurrency(summary.totalCashPaid)}`,
    pendingLabel: `Pending Amount: ${formatCurrency(summary.totalPending)}`,
    advanceLabel: `Advance: ${formatCurrency(summary.creditBalance)}`,
    statusLabel: getPaymentStatusLabel(summary),
  };
}
