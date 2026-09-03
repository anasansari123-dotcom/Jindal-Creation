import type { IDispatch } from "@/lib/models/Dispatch";
import {
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

export type OrderDisplayStatus = "PENDING" | "COMPLETED";

export interface DispatchStatusHistoryEntry {
  status: OrderDisplayStatus;
  billStatus: "DISPATCH" | "FINAL";
  date: Date | string;
  note: string;
  byName: string;
}

export interface DispatchOrderEntry {
  _id: string;
  orderId: string;
  displayBillId: string;
  billStatus: "DISPATCH" | "FINAL";
  status: OrderDisplayStatus;
  customerName: string;
  customerCode?: string;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  orderDate: string;
  readyByDate?: string;
  orderType?: "immediate" | "advance";
  completedDate?: string;
  salespersonName: string;
  finalBillId?: string;
  itemCount: number;
  statusHistory: DispatchStatusHistoryEntry[];
  href: string;
  fulfillmentLabel: string;
}

export interface DailyOrderSummary {
  date: string;
  label: string;
  pending: number;
  completed: number;
  total: number;
  totalAmount: number;
  orders: DispatchOrderEntry[];
}

export function dispatchOrderStatus(billStatus: "DISPATCH" | "FINAL"): OrderDisplayStatus {
  return billStatus === "FINAL" ? "COMPLETED" : "PENDING";
}

export function buildStatusHistory(dispatch: {
  billStatus: "DISPATCH" | "FINAL";
  dispatchDate: Date | string;
  convertedAt?: Date | string;
  finalBillId?: string;
  salespersonName: string;
  verifiedByName?: string;
  statusHistory?: DispatchStatusHistoryEntry[];
}): DispatchStatusHistoryEntry[] {
  if (dispatch.statusHistory && dispatch.statusHistory.length > 0) {
    return dispatch.statusHistory;
  }

  const history: DispatchStatusHistoryEntry[] = [
    {
      status: "PENDING",
      billStatus: "DISPATCH",
      date: dispatch.dispatchDate,
      note: "Dispatch bill create hui — order pending",
      byName: dispatch.salespersonName,
    },
  ];

  if (dispatch.billStatus === "FINAL") {
    history.push({
      status: "COMPLETED",
      billStatus: "FINAL",
      date: dispatch.convertedAt || dispatch.dispatchDate,
      note: dispatch.finalBillId
        ? `Final bill ${dispatch.finalBillId} — order complete`
        : "Final bill ban gayi — order complete",
      byName: dispatch.verifiedByName || dispatch.salespersonName,
    });
  }

  return history;
}

export function dispatchToOrderEntry(
  dispatch: Pick<
    IDispatch,
    | "_id"
    | "dispatchId"
    | "finalBillId"
    | "billStatus"
    | "customerName"
    | "customerCode"
    | "total"
    | "advance"
    | "pending"
    | "paymentStatus"
    | "dispatchDate"
    | "convertedAt"
    | "orderType"
    | "readyByDate"
    | "salespersonName"
    | "verifiedByName"
    | "items"
    | "statusHistory"
  > & { statusHistory?: DispatchStatusHistoryEntry[] }
): DispatchOrderEntry {
  const statusHistory = buildStatusHistory(dispatch);
  return {
    _id: dispatch._id.toString(),
    orderId: dispatch.dispatchId,
    displayBillId:
      dispatch.billStatus === "FINAL" && dispatch.finalBillId
        ? dispatch.finalBillId
        : dispatch.dispatchId,
    billStatus: dispatch.billStatus,
    status: dispatchOrderStatus(dispatch.billStatus),
    customerName: dispatch.customerName,
    customerCode: dispatch.customerCode,
    total: dispatch.total,
    advance: dispatch.advance,
    pending: dispatch.pending,
    paymentStatus: dispatch.paymentStatus,
    orderDate: new Date(dispatch.dispatchDate).toISOString(),
    readyByDate: dispatch.readyByDate
      ? new Date(dispatch.readyByDate).toISOString()
      : undefined,
    orderType: dispatch.orderType || "immediate",
    completedDate: dispatch.convertedAt
      ? new Date(dispatch.convertedAt).toISOString()
      : undefined,
    salespersonName: dispatch.salespersonName,
    finalBillId: dispatch.finalBillId,
    itemCount: dispatch.items?.length || 0,
    statusHistory,
    href: `/admin/dispatch/${dispatch._id.toString()}`,
    fulfillmentLabel:
      dispatch.billStatus === "FINAL"
        ? "Final Bill"
        : dispatch.orderType === "advance"
          ? "Advance Order"
          : "Dispatch Bill",
  };
}

export function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
}

export type OrderPeriod = "today" | "yesterday" | "week" | "month" | "custom";

export function periodRange(period: OrderPeriod, customDate?: string) {
  const now = new Date();
  const end = endOfDay(now);

  switch (period) {
    case "yesterday": {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y), label: "Kal" };
    }
    case "week": {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      // Is hafte ka Mon agar pichle mahine me ho to is mahine ke 1 se start karo
      const start = weekStart < monthStart ? monthStart : weekStart;
      return { start, end, label: "Is Week" };
    }
    case "month": {
      return { start: startOfMonth(now), end, label: "Is Month" };
    }
    case "custom": {
      if (customDate) {
        const range = dayRange(customDate);
        return { ...range, label: formatDayLabel(customDate) };
      }
      return { start: startOfDay(now), end, label: "Aaj" };
    }
    case "today":
    default:
      return { start: startOfDay(now), end, label: "Aaj" };
  }
}

export function summarizeDispatchesLean(
  dispatches: Array<{ billStatus: "DISPATCH" | "FINAL"; total: number }>
) {
  let pending = 0;
  let completed = 0;
  let pendingAmount = 0;
  let completedAmount = 0;

  for (const d of dispatches) {
    if (d.billStatus === "FINAL") {
      completed += 1;
      completedAmount += d.total;
    } else {
      pending += 1;
      pendingAmount += d.total;
    }
  }

  return {
    pending,
    completed,
    total: dispatches.length,
    totalAmount: pendingAmount + completedAmount,
    pendingAmount,
    completedAmount,
  };
}

export function formatDayLabel(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T12:00:00.000`);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Aaj";
  if (diff === 1) return "Kal";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function dateKey(iso: string | Date) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupOrdersByDay(orders: DispatchOrderEntry[]): DailyOrderSummary[] {
  const map = new Map<string, DispatchOrderEntry[]>();
  for (const order of orders) {
    const key = dateKey(order.orderDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(order);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayOrders]) => ({
      date,
      label: formatDayLabel(date),
      pending: dayOrders.filter((o) => o.status === "PENDING").length,
      completed: dayOrders.filter((o) => o.status === "COMPLETED").length,
      total: dayOrders.length,
      totalAmount: dayOrders.reduce((s, o) => s + o.total, 0),
      orders: dayOrders.sort(
        (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      ),
    }));
}

export function summarizeOrders(orders: DispatchOrderEntry[]) {
  return {
    pending: orders.filter((o) => o.status === "PENDING").length,
    completed: orders.filter((o) => o.status === "COMPLETED").length,
    total: orders.length,
    totalAmount: orders.reduce((s, o) => s + o.total, 0),
    pendingAmount: orders
      .filter((o) => o.status === "PENDING")
      .reduce((s, o) => s + o.total, 0),
    completedAmount: orders
      .filter((o) => o.status === "COMPLETED")
      .reduce((s, o) => s + o.total, 0),
  };
}
