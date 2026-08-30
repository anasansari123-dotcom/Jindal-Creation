import { dispatchOrderStatus } from "@/lib/dispatch-orders";

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
  paymentStatus: string;
  dispatchDate: Date | string;
  salespersonName: string;
  items: Array<{
    productCode?: string;
    productName?: string;
    pieces?: number;
    boxes?: number;
    quantity?: number;
    total?: number;
  }>;
}

export function summarizeDispatchSales(dispatches: DispatchSalesDoc[]) {
  return {
    totalSales: dispatches.reduce((s, d) => s + d.total, 0),
    totalOrders: dispatches.length,
    totalPieces: dispatches.reduce(
      (s, d) => s + d.items.reduce((is, i) => is + (i.pieces || 0), 0),
      0
    ),
    totalBoxes: dispatches.reduce(
      (s, d) => s + d.items.reduce((is, i) => is + (i.boxes || 0), 0),
      0
    ),
    totalAdvance: dispatches.reduce((s, d) => s + d.advance, 0),
    totalPending: dispatches.reduce((s, d) => s + d.pending, 0),
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
  return {
    _id: d._id.toString(),
    orderId:
      d.billStatus === "FINAL" && d.finalBillId ? d.finalBillId : d.dispatchId,
    dispatchId: d.dispatchId,
    customerName: d.customerName,
    total: d.total,
    advance: d.advance,
    pending: d.pending,
    paymentStatus: d.paymentStatus,
    status: dispatchOrderStatus(d.billStatus),
    fulfillmentLabel:
      d.billStatus === "FINAL" ? "Final Bill" : "Dispatch Bill",
    orderDate: new Date(d.dispatchDate).toISOString(),
    salespersonName: d.salespersonName,
    href: `/admin/dispatch/${d._id.toString()}`,
  };
}
