import { formatBoxPieces } from "@/lib/utils";

export type SellingUnit = "box" | "piece" | "kg";
export type StockInputUnit = "pieces" | "boxes" | "kg";

export function isKgProduct(p: { sellingUnit?: string; unit?: string }): boolean {
  return p.sellingUnit === "kg" || p.unit?.trim().toLowerCase() === "kg";
}

export function formatKgQty(kg: number): string {
  const rounded = Math.round(kg * 1000) / 1000;
  const str = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(3).replace(/\.?0+$/, "");
  return `${str} Kg`;
}

export function formatProductStock(p: {
  currentStock: number;
  piecesPerBox: number;
  sellingUnit?: string;
  unit?: string;
}): string {
  if (isKgProduct(p)) {
    if (p.currentStock <= 0) return "0 Kg";
    return formatKgQty(p.currentStock);
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
