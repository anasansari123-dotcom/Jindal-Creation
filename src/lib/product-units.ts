import { formatBoxPieces } from "@/lib/utils";

export type SellingUnit = "box" | "piece" | "kg";
export type StockInputUnit = "pieces" | "boxes" | "kg";

export function isKgProduct(p: { sellingUnit?: string; unit?: string }): boolean {
  return p.sellingUnit === "kg" || p.unit?.trim().toLowerCase() === "kg";
}

export function isPieceProduct(p: { sellingUnit?: string; unit?: string }): boolean {
  return p.sellingUnit === "piece" || p.unit?.trim().toLowerCase() === "piece";
}

export function isBoxProduct(p: { sellingUnit?: string; unit?: string }): boolean {
  return !isKgProduct(p) && !isPieceProduct(p);
}

const SELLING_UNIT_LABELS: Record<SellingUnit, string> = {
  box: "Box",
  piece: "Piece",
  kg: "Kg",
};

export function formatSellingUnitLabel(unit: SellingUnit | string): string {
  return SELLING_UNIT_LABELS[unit as SellingUnit] ?? "Box";
}

export function formatRatePerUnitLabel(unit: SellingUnit | string): string {
  return `Rate / ${formatSellingUnitLabel(unit)} (₹)`;
}

export function formatKgQty(kg: number, allowNegative = false): string {
  const abs = Math.abs(kg);
  const rounded = Math.round(abs * 1000) / 1000;
  const str = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(3).replace(/\.?0+$/, "");
  if (kg < 0 && allowNegative) return `(-) ${str} Kg`;
  return `${str} Kg`;
}

export function formatProductStock(p: {
  currentStock: number;
  piecesPerBox: number;
  sellingUnit?: string;
  unit?: string;
}): string {
  if (isKgProduct(p)) {
    if (p.currentStock === 0) return "0 Kg";
    if (p.currentStock < 0) return formatKgQty(p.currentStock, true);
    return formatKgQty(p.currentStock);
  }
  if (p.currentStock < 0) {
    return `(-) ${formatBoxPieces(Math.abs(p.currentStock), p.piecesPerBox)}`;
  }
  return formatBoxPieces(p.currentStock, p.piecesPerBox);
}

export function stockInputToStorage(
  quantity: number,
  stockUnit: StockInputUnit,
  piecesPerBox: number,
  sellingUnit?: string
): number {
  if (stockUnit === "kg" || sellingUnit === "kg") return quantity;
  if (stockUnit === "boxes") return quantity * Math.max(piecesPerBox, 1);
  return quantity;
}
