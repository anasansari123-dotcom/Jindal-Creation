import { enrichBillLineItem, looseShortfallQty, type SellMode } from "@/lib/bill-pricing";

export type ProductHistoryBillType = "Order" | "Dispatch" | "Final" | "Confirm";

export interface ProductHistoryEntry {
  date: Date | string;
  customerId?: string;
  customerName: string;
  customerCode?: string;
  billId: string;
  /** Dispatch bill code — matches InventoryTransaction.orderId */
  dispatchCode?: string;
  billType: ProductHistoryBillType;
  billLink?: string;
  pieces: number;
  boxes: number;
  fullBoxes: number;
  loosePieces: number;
  quantity: number;
  unitPrice: number;
  piecePrice: number;
  piecesPerBox: number;
  sellMode: SellMode;
  total: number;
  soldWithoutPurchase?: boolean;
  shortfallQty?: number;
}

interface LineItem {
  productId?: { toString(): string };
  productCode: string;
  productName: string;
  quantity: number;
  pieces: number;
  boxes: number;
  piecesPerBox?: number;
  fullBoxes?: number;
  loosePieces?: number;
  piecePrice?: number;
  discount?: number;
  sellMode?: SellMode;
  unitPrice: number;
  total: number;
}

function lineToHistoryFields(item: LineItem) {
  const pricing = enrichBillLineItem(item);
  return {
    pieces: pricing.pieces,
    boxes: pricing.fullBoxes,
    fullBoxes: pricing.fullBoxes,
    loosePieces: pricing.loosePieces,
    quantity: item.quantity,
    unitPrice: pricing.boxPrice,
    piecePrice: pricing.piecePrice,
    piecesPerBox: item.piecesPerBox || 1,
    sellMode: pricing.sellMode,
    total: pricing.total,
  };
}

function correctedLineTotal(item: LineItem): number {
  return lineToHistoryFields(item).total;
}

interface OrderDoc {
  _id: { toString(): string };
  orderId: string;
  orderDate: Date | string;
  customerId?: { toString(): string };
  customerName: string;
  customerCode: string;
  items: LineItem[];
}

interface DispatchDoc {
  _id: { toString(): string };
  dispatchId: string;
  finalBillId?: string;
  billStatus: "DISPATCH" | "FINAL";
  orderId?: { toString(): string };
  customerId?: { toString(): string };
  customerName: string;
  customerCode?: string;
  dispatchDate: Date | string;
  items: LineItem[];
}

interface ConfirmDoc {
  _id: { toString(): string };
  confirmBillId: string;
  orderId: { toString(): string };
  confirmDate: Date | string;
  customerId?: { toString(): string };
  customerName: string;
  customerCode: string;
  items: LineItem[];
}

function matchesProduct(
  item: LineItem,
  productMongoId: string,
  productCode: string
): boolean {
  if (item.productId?.toString() === productMongoId) return true;
  return item.productCode === productCode;
}

function pushEntry(
  entries: ProductHistoryEntry[],
  seen: Set<string>,
  key: string,
  entry: ProductHistoryEntry
) {
  if (seen.has(key)) return;
  seen.add(key);
  entries.push(entry);
}

/** Build customer-wise dispatch/sale history for one product (deduped) */
export function buildProductHistory(
  productMongoId: string,
  productCode: string,
  orders: OrderDoc[],
  dispatches: DispatchDoc[],
  confirmBills: ConfirmDoc[]
): ProductHistoryEntry[] {
  const entries: ProductHistoryEntry[] = [];
  const seen = new Set<string>();
  const coveredOrders = new Set<string>();

  const finalBillIds = new Set(
    dispatches
      .filter((d) => d.billStatus === "FINAL")
      .map((d) => d.finalBillId || d.dispatchId)
  );

  for (const cb of confirmBills) {
    if (finalBillIds.has(cb.confirmBillId)) continue;
    const oid = cb.orderId.toString();
    coveredOrders.add(oid);
    for (const item of cb.items) {
      if (!matchesProduct(item, productMongoId, productCode)) continue;
      pushEntry(entries, seen, `confirm:${cb._id}:${productMongoId}`, {
        date: cb.confirmDate,
        customerId: cb.customerId?.toString(),
        customerName: cb.customerName,
        customerCode: cb.customerCode,
        billId: cb.confirmBillId,
        billType: "Confirm",
        ...lineToHistoryFields(item),
      });
    }
  }

  for (const d of dispatches) {
    if (coveredOrders.has(d._id.toString())) continue;
    if (d.orderId && coveredOrders.has(d.orderId.toString())) continue;
    if (d.orderId) coveredOrders.add(d.orderId.toString());

    const billType: ProductHistoryBillType =
      d.billStatus === "FINAL" ? "Final" : "Dispatch";
    const billId =
      d.billStatus === "FINAL" && d.finalBillId ? d.finalBillId : d.dispatchId;

    for (const item of d.items) {
      if (!matchesProduct(item, productMongoId, productCode)) continue;
      pushEntry(entries, seen, `dispatch:${d._id}:${productMongoId}`, {
        date: d.dispatchDate,
        customerId: d.customerId?.toString(),
        customerName: d.customerName,
        customerCode: d.customerCode,
        billId,
        dispatchCode: d.dispatchId,
        billType,
        billLink: `/admin/dispatch/${d._id.toString()}`,
        ...lineToHistoryFields(item),
      });
    }
  }

  for (const o of orders) {
    const oid = o._id.toString();
    if (coveredOrders.has(oid)) continue;

    for (const item of o.items) {
      if (!matchesProduct(item, productMongoId, productCode)) continue;
      pushEntry(entries, seen, `order:${o._id}:${productMongoId}`, {
        date: o.orderDate,
        customerId: o.customerId?.toString(),
        customerName: o.customerName,
        customerCode: o.customerCode,
        billId: o.orderId,
        billType: "Order",
        billLink: `/admin/orders/${oid}`,
        ...lineToHistoryFields(item),
      });
    }
  }

  return entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function summarizeProductHistory(
  entries: ProductHistoryEntry[],
  currentStock?: number
) {
  const totalSoldWithoutPurchase = entries.reduce(
    (s, e) => s + (e.shortfallQty || 0),
    0
  );
  return {
    totalEntries: entries.length,
    totalPieces: entries.reduce((s, e) => s + e.loosePieces, 0),
    totalBoxes: entries.reduce((s, e) => s + e.fullBoxes, 0),
    totalLoosePieces: entries.reduce((s, e) => s + e.loosePieces, 0),
    totalAmount: entries.reduce((s, e) => s + e.total, 0),
    uniqueCustomers: new Set(entries.map((e) => e.customerName)).size,
    totalSoldWithoutPurchase,
    binaPurchaseSales: entries.filter((e) => (e.shortfallQty || 0) > 0).length,
    isNegativeStock: currentStock !== undefined && currentStock < 0,
  };
}

/** Attach bina-purchase shortfall from Final Bill inventory transactions */
export function enrichHistoryWithOversales(
  entries: ProductHistoryEntry[],
  transactions: Array<{
    orderId?: string;
    shortfallQty?: number;
    soldWithoutPurchase?: boolean;
  }>
): ProductHistoryEntry[] {
  const shortfallByDispatch = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.orderId || !tx.soldWithoutPurchase) continue;
    shortfallByDispatch.set(
      tx.orderId,
      (shortfallByDispatch.get(tx.orderId) || 0) + (tx.shortfallQty || 0)
    );
  }

  return entries.map((entry) => {
    if (!entry.dispatchCode) return entry;
    const shortfallTotal = shortfallByDispatch.get(entry.dispatchCode) || 0;
    if (shortfallTotal <= 0) return entry;
    const shortfallQty = looseShortfallQty(shortfallTotal, {
      pieces: entry.pieces,
      boxes: entry.fullBoxes,
      fullBoxes: entry.fullBoxes,
      loosePieces: entry.loosePieces,
      piecesPerBox: entry.piecesPerBox,
      sellMode: entry.sellMode,
      quantity: entry.quantity,
    });
    if (shortfallQty <= 0) return entry;
    return {
      ...entry,
      soldWithoutPurchase: true,
      shortfallQty,
    };
  });
}
