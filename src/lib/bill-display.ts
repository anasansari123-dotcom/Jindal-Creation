/** Canonical bill ID shown across Create Bill, Customers, Payments, Orders */
export function getDisplayBillId(bill: {
  billStatus?: "DISPATCH" | "FINAL";
  finalBillId?: string;
  dispatchId?: string;
  confirmBillId?: string;
}) {
  if (bill.billStatus === "FINAL" && bill.finalBillId) return bill.finalBillId;
  if (bill.confirmBillId) return bill.confirmBillId;
  return bill.dispatchId || bill.confirmBillId || "—";
}

/** Resolve customer display name — prefer linked Customer record when provided */
export function resolveCustomerDisplayName(
  billName: string | undefined,
  customer?: { name?: string } | null
) {
  if (customer?.name?.trim()) return customer.name.trim();
  return billName?.trim() || "—";
}
