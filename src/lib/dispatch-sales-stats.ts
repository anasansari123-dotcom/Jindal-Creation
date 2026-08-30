import { dispatchOrderStatus } from "@/lib/dispatch-orders";
import { boxesSoldFromLine, loosePiecesSoldFromLine } from "@/lib/bill-pricing";
import {
  getBillPaymentDisplay,
  type BillPaymentFields,
} from "@/lib/bill-payment-display";

export interface DispatchSalesDoc {
  _id: { toString(): string };
  dispatchId: string;
  finalBillId?: string;
  billStatus: "DISPATCH" | "FINAL";
  customerName: string;
  customerCode?: string;
  total: number;
  advance: number;
  pending: number;
  cashPaid?: number;
  creditAdded?: number;
  creditApplied?: number;
  paymentStatus: string;
  dispatchDate: Date | string;
  salespersonName: string;
  items: Array<{
    productCode?: string;
    productName?: string;
    pieces?: number;
    boxes?: number;
    fullBoxes?: number;
    loosePieces?: number;
    piecesPerBox?: number;
    unitPrice?: number;
    sellMode?: "box" | "piece" | "mixed" | "kg";
    quantity?: number;
    total?: number;
  }>;
}

export function dispatchDocToPaymentFields(
  d: DispatchSalesDoc
): BillPaymentFields {
  return {
    total: d.total,
    advance: d.advance,
    pending: d.pending,
    cashPaid: d.cashPaid,
    creditAdded: d.creditAdded,
    creditApplied: d.creditApplied,
  };
}

export function summarizeDispatchSales(dispatches: DispatchSalesDoc[]) {
  let totalCashPaid = 0;
  let totalPending = 0;
  let totalAdvanceSaved = 0;

  for (const d of dispatches) {
    const payment = getBillPaymentDisplay(dispatchDocToPaymentFields(d));
    totalCashPaid += payment.cashPaid;
    totalPending += payment.pending;
    totalAdvanceSaved += payment.creditAdded;
  }

  return {
    totalSales: dispatches.reduce((s, d) => s + d.total, 0),
    totalOrders: dispatches.length,
    totalPieces: dispatches.reduce(
      (s, d) => s + d.items.reduce((is, i) => is + loosePiecesSoldFromLine(i), 0),
      0
    ),
    totalBoxes: dispatches.reduce(
      (s, d) => s + d.items.reduce((is, i) => is + boxesSoldFromLine(i), 0),
      0
    ),
    totalCashPaid,
    totalPending,
    totalAdvanceSaved,
  };
}

export function buildSalesChartData(dispatches: DispatchSalesDoc[]) {
  const salesByDay: Record<string, number> = {};
  for (const d of dispatches) {
    const day = new Date(d.dispatchDate).toISOString().split("T")[0];
    salesByDay[day] = (salesByDay[day] || 0) + d.total;
  }
  return Object.entries(salesByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sales]) => ({ date, sales }));
}

export function dispatchToSalesRow(d: DispatchSalesDoc) {
  const payment = getBillPaymentDisplay(dispatchDocToPaymentFields(d));

  return {
    _id: d._id.toString(),
    orderId:
      d.billStatus === "FINAL" && d.finalBillId ? d.finalBillId : d.dispatchId,
    dispatchId: d.dispatchId,
    customerName: d.customerName,
    total: d.total,
    cashPaid: payment.cashPaid,
    advance: payment.billPaid,
    pending: payment.pending,
    advanceSaved: payment.creditAdded,
    paymentStatus: d.paymentStatus,
    status: dispatchOrderStatus(d.billStatus),
    fulfillmentLabel:
      d.billStatus === "FINAL" ? "Final Bill" : "Dispatch Bill",
    orderDate: new Date(d.dispatchDate).toISOString(),
    salespersonName: d.salespersonName,
    href: `/admin/dispatch/${d._id.toString()}`,
  };
}
