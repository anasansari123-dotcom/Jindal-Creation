import { getStockSplit } from "@/lib/bill-pricing";

/** How available stock is split for display (not sales mode) */
export type StockDisplayMode = "empty" | "box" | "piece" | "both";

export function getStockDisplayMode(fullBoxes: number, loosePieces: number): StockDisplayMode {
  const boxes = Math.max(0, fullBoxes);
  const pcs = Math.max(0, loosePieces);
  if (boxes === 0 && pcs === 0) return "empty";
  if (boxes > 0 && pcs === 0) return "box";
  if (boxes === 0 && pcs > 0) return "piece";
  return "both";
}

export function formatAvailableStockUnit(fullBoxes: number, loosePieces: number): string {
  const mode = getStockDisplayMode(fullBoxes, loosePieces);
  if (mode === "box") return "Box";
  if (mode === "piece") return "Piece";
  if (mode === "both") return "Box + Piece";
  return "—";
}

/** Single line: only shows box OR piece OR both — never "0 Box" */
export function formatAvailableStockQty(fullBoxes: number, loosePieces: number): string {
  const mode = getStockDisplayMode(fullBoxes, loosePieces);
  if (mode === "empty") return "Out of Stock";
  if (mode === "box") {
    return `${fullBoxes} Box${fullBoxes > 1 ? "es" : ""} available`;
  }
  if (mode === "piece") {
    return `${loosePieces} Pc${loosePieces > 1 ? "s" : ""} available`;
  }
  return `${fullBoxes} Box + ${loosePieces} Pc available`;
}

/** Table/PDF box column — "—" when stock is piece-only */
export function formatAvailableStockBoxCell(fullBoxes: number, loosePieces: number): string {
  const mode = getStockDisplayMode(fullBoxes, loosePieces);
  if (mode === "box" || mode === "both") return String(fullBoxes);
  return "—";
}

/** Table/PDF piece column — "—" when stock is box-only */
export function formatAvailableStockPieceCell(fullBoxes: number, loosePieces: number): string {
  const mode = getStockDisplayMode(fullBoxes, loosePieces);
  if (mode === "piece" || mode === "both") return String(loosePieces);
  return "—";
}

export interface AvailableStockView {
  fullBoxes: number;
  loosePieces: number;
  totalPieces: number;
  mode: StockDisplayMode;
  unit: string;
  summary: string;
  boxCell: string;
  pieceCell: string;
}

export function formatAvailableStockFromPieces(
  pieces: number,
  piecesPerBox: number
): AvailableStockView {
  const { fullBoxes, loosePieces, piecesPerBox: ppb } = getStockSplit(pieces, piecesPerBox);
  const mode = getStockDisplayMode(fullBoxes, loosePieces);
  return {
    fullBoxes,
    loosePieces,
    totalPieces: pieces,
    mode,
    unit: formatAvailableStockUnit(fullBoxes, loosePieces),
    summary: formatAvailableStockQty(fullBoxes, loosePieces),
    boxCell: formatAvailableStockBoxCell(fullBoxes, loosePieces),
    pieceCell: formatAvailableStockPieceCell(fullBoxes, loosePieces),
  };
}

export function summarizeInventoryExport(
  items: Array<{ boxes: number; loosePieces: number; stockStatus: string }>
) {
  const boxOnly = items.filter((i) => getStockDisplayMode(i.boxes, i.loosePieces) === "box").length;
  const pieceOnly = items.filter((i) => getStockDisplayMode(i.boxes, i.loosePieces) === "piece").length;
  const both = items.filter((i) => getStockDisplayMode(i.boxes, i.loosePieces) === "both").length;
  const totalFullBoxes = items.reduce((s, i) => s + i.boxes, 0);
  const totalLoosePcs = items.reduce((s, i) => s + i.loosePieces, 0);

  return {
    products: items.length,
    inStock: items.filter((i) => i.stockStatus === "In Stock").length,
    lowStock: items.filter((i) => i.stockStatus === "Low Stock").length,
    outStock: items.filter((i) => i.stockStatus === "Out of Stock").length,
    boxOnly,
    pieceOnly,
    both,
    totalFullBoxes,
    totalLoosePcs,
  };
}
