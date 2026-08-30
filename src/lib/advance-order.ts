export type OrderType = "immediate" | "advance";

export type AdvanceDueStatus = "due_today" | "overdue" | "upcoming";

export function isAdvanceOrder(orderType?: string | null): boolean {
  return orderType === "advance";
}

export function getAdvanceDueStatus(
  readyByDate?: string | Date | null,
  billStatus?: string
): AdvanceDueStatus | null {
  if (!readyByDate || billStatus === "FINAL") return null;
  const due = new Date(readyByDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due.getTime() === today.getTime()) return "due_today";
  if (due.getTime() < today.getTime()) return "overdue";
  return "upcoming";
}

export function advanceDueLabel(status: AdvanceDueStatus | null): string {
  if (status === "due_today") return "Aaj ready";
  if (status === "overdue") return "Due date cross";
  if (status === "upcoming") return "Advance booking";
  return "";
}
