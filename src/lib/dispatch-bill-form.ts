import { calculateBillLineTotal, piecePriceFromBox } from "@/lib/bill-pricing";
import { isKgProduct } from "@/lib/product-units";

/** One product row on dispatch bill create/edit forms */
export interface BillItemRow {
  id: string;
  productId: string;
  boxQty: number;
  pieceQty: number;
  kgQty: number;
  boxPrice: number;
  piecePrice: number;
  kgPrice: number;
}

export interface BillFormProduct {
  _id: string;
  productId: string;
  name: string;
  sellingPrice: number;
  piecesPerBox: number;
  currentStock: number;
  sellingUnit?: string;
  unit?: string;
}

let rowIdCounter = 0;

export function newBillItemRowId(): string {
  rowIdCounter += 1;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `bill-row-${Date.now()}-${rowIdCounter}`;
}

export function emptyBillItemRow(): BillItemRow {
  return {
    id: newBillItemRowId(),
    productId: "",
    boxQty: 0,
    pieceQty: 0,
    kgQty: 0,
    boxPrice: 0,
    piecePrice: 0,
    kgPrice: 0,
  };
}

export function defaultPricesForProduct(product: BillFormProduct) {
  const ppb = Math.max(product.piecesPerBox, 1);
  return {
    boxPrice: product.sellingPrice,
    piecePrice: piecePriceFromBox(product.sellingPrice, ppb),
    kgPrice: isKgProduct(product) ? product.sellingPrice : 0,
  };
}

export function billItemRowHasQty(
  row: BillItemRow,
  product?: Pick<BillFormProduct, "sellingUnit" | "unit">
): boolean {
  if (product && isKgProduct(product)) return row.kgQty > 0;
  return row.boxQty > 0 || row.pieceQty > 0;
}

export function patchBillItemField(
  row: BillItemRow,
  field: keyof BillItemRow,
  value: string | number,
  product?: BillFormProduct
): BillItemRow {
  if (field === "productId" && typeof value === "string") {
    if (product) {
      return {
        ...row,
        productId: value,
        ...defaultPricesForProduct(product),
      };
    }
    return { ...row, productId: value };
  }
  return { ...row, [field]: value };
}

export function buildBillPreviewLines(item: BillItemRow, product: BillFormProduct) {
  const lines: ReturnType<typeof calculateBillLineTotal>[] = [];
  const ppb = Math.max(product.piecesPerBox, 1);
  const boxPrice = item.boxPrice || product.sellingPrice;
  const piecePrice =
    item.piecePrice || piecePriceFromBox(product.sellingPrice, ppb);
  const kgPrice = item.kgPrice || product.sellingPrice;

  if (isKgProduct(product)) {
    if (item.kgQty > 0) {
      lines.push(
        calculateBillLineTotal({
          sellMode: "kg",
          kgQty: item.kgQty,
          boxPrice: kgPrice,
          kgPrice,
          piecesPerBox: 1,
        })
      );
    }
    return lines;
  }

  if (item.boxQty > 0) {
    lines.push(
      calculateBillLineTotal({
        sellMode: "box",
        boxQty: item.boxQty,
        boxPrice,
        piecesPerBox: ppb,
      })
    );
  }
  if (item.pieceQty > 0) {
    lines.push(
      calculateBillLineTotal({
        sellMode: "piece",
        pieceQty: item.pieceQty,
        boxPrice,
        piecePrice,
        piecesPerBox: ppb,
      })
    );
  }
  return lines;
}

export function billItemRowTotal(item: BillItemRow, product: BillFormProduct): number {
  return buildBillPreviewLines(item, product).reduce((s, line) => s + line.total, 0);
}

export function totalQtyForBillItem(item: BillItemRow, product: BillFormProduct) {
  if (isKgProduct(product)) return item.kgQty;
  const ppb = Math.max(product.piecesPerBox, 1);
  return item.boxQty * ppb + item.pieceQty;
}

export function billItemRowToApiPayload(item: BillItemRow, product: BillFormProduct) {
  const ppb = Math.max(product.piecesPerBox, 1);
  if (isKgProduct(product)) {
    return {
      productId: item.productId,
      kgQty: item.kgQty,
      unitPrice: item.kgPrice || product.sellingPrice,
    };
  }
  return {
    productId: item.productId,
    boxQty: item.boxQty,
    pieceQty: item.pieceQty,
    unitPrice: item.boxPrice || product.sellingPrice,
    pieceUnitPrice:
      item.piecePrice || piecePriceFromBox(product.sellingPrice, ppb),
  };
}

/** Append new lines — never merge or drop rows by productId */
export function mergeBillItemRows(
  existing: BillItemRow[],
  added: BillItemRow[],
  products: BillFormProduct[] = []
): BillItemRow[] {
  const kept = existing.filter((row) => {
    if (!row.productId) return false;
    const product = products.find((p) => p._id === row.productId);
    return billItemRowHasQty(row, product);
  });

  const normalizedAdded = added.map((row) => ({
    ...row,
    id: row.id || newBillItemRowId(),
  }));

  return [...kept, ...normalizedAdded];
}

export function ensureBillItemRowIds(rows: BillItemRow[]): BillItemRow[] {
  return rows.map((row) => ({
    ...row,
    id: row.id || newBillItemRowId(),
  }));
}
