import type { BillItemRow, BillFormProduct } from "@/lib/dispatch-bill-form";

const STORAGE_KEY = "jcrm:dispatch-bill-draft";

export interface DispatchBillDraft {
  version: 1;
  savedAt: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  dispatchDate: string;
  orderType: "immediate" | "advance";
  readyByDate: string;
  discount: number;
  advance: number;
  paymentMode: string;
  salespersonName: string;
  notes: string;
  items: BillItemRow[];
  extraProducts: BillFormProduct[];
  includeCarriedForward: boolean;
}

export type DispatchBillDraftInput = Omit<DispatchBillDraft, "version" | "savedAt">;

export function loadDispatchBillDraft(): DispatchBillDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DispatchBillDraft;
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDispatchBillDraft(draft: DispatchBillDraftInput): void {
  if (typeof window === "undefined") return;
  try {
    const payload: DispatchBillDraft = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...draft,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode errors
  }
}

export function clearDispatchBillDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function dispatchBillDraftHasContent(draft: DispatchBillDraftInput): boolean {
  const hasItems = draft.items.some(
    (row) =>
      row.productId ||
      row.boxQty > 0 ||
      row.pieceQty > 0 ||
      row.kgQty > 0
  );
  return Boolean(
    draft.customerName.trim() ||
      draft.customerPhone.trim() ||
      draft.customerCompany.trim() ||
      hasItems ||
      draft.advance > 0 ||
      draft.discount > 0 ||
      draft.notes.trim() ||
      draft.readyByDate.trim()
  );
}
