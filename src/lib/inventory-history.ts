import type { InventoryTransactionType } from "@/lib/constants";
import { formatBoxPieces } from "@/lib/utils";

export { formatBoxPieces };

export interface InventoryHistoryRow {
  _id: string;
  productName: string;
  productCode: string;
  type: InventoryTransactionType;
  typeLabel: string;
  quantity: number;
  pieces: number;
  boxes: number;
  change: number;
  qtyLabel: string;
  previousStock: number;
  newStock: number;
  beforeLabel: string;
  afterLabel: string;
  notes?: string;
  createdByName: string;
  createdAt: Date | string;
  reference?: string;
  customerName?: string;
  billLink?: string;
}

const TYPE_LABELS: Record<InventoryTransactionType, string> = {
  STOCK_IN: "Stock In",
  SALE: "Sale",
  ADJUSTMENT: "Adjustment",
  RETURN: "Return",
};

function cleanNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const cleaned = notes
    .replace(/\s*\(seed\)/gi, "")
    .replace(/\s*seed\s*$/i, "")
    .replace(/^Initial stock\s*—?\s*/i, "Opening stock received")
    .trim();
  return cleaned || undefined;
}

export function inventoryChange(
  type: InventoryTransactionType,
  quantity: number,
  previousStock: number,
  newStock: number
): number {
  if (type === "ADJUSTMENT") return newStock - previousStock;
  if (type === "SALE") return -quantity;
  return quantity;
}

export function formatInventoryHistoryRow(
  tx: {
    _id: { toString(): string };
    productName: string;
    productCode: string;
    type: InventoryTransactionType;
    quantity: number;
    pieces?: number;
    boxes?: number;
    previousStock: number;
    newStock: number;
    notes?: string;
    createdByName: string;
    createdAt: Date | string;
    orderId?: string;
  },
  dispatch?: {
    _id: { toString(): string };
    customerName?: string;
    dispatchId: string;
    finalBillId?: string;
  } | null,
  piecesPerBox = 1
): InventoryHistoryRow {
  const reference = tx.orderId;
  let billLink: string | undefined;
  let customerName: string | undefined;

  if (dispatch) {
    customerName = dispatch.customerName;
    billLink = `/admin/dispatch/${dispatch._id.toString()}`;
  }

  const pieceCount = tx.pieces || tx.quantity;
  const boxCount = tx.boxes ?? Math.floor(pieceCount / Math.max(piecesPerBox, 1));

  return {
    _id: tx._id.toString(),
    productName: tx.productName,
    productCode: tx.productCode,
    type: tx.type,
    typeLabel: TYPE_LABELS[tx.type] || tx.type,
    quantity: tx.quantity,
    pieces: pieceCount,
    boxes: boxCount,
    change: inventoryChange(tx.type, tx.quantity, tx.previousStock, tx.newStock),
    qtyLabel: formatBoxPieces(pieceCount, piecesPerBox, boxCount),
    previousStock: tx.previousStock,
    newStock: tx.newStock,
    beforeLabel: formatBoxPieces(tx.previousStock, piecesPerBox),
    afterLabel: formatBoxPieces(tx.newStock, piecesPerBox),
    notes: cleanNotes(tx.notes),
    createdByName: tx.createdByName,
    createdAt: tx.createdAt,
    reference,
    customerName,
    billLink,
  };
}
