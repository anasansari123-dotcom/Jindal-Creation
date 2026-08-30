/** Product sellingPrice = price per box. Piece rate is derived from box rate. */

export type SellMode = "box" | "piece" | "mixed" | "kg";

export function piecePriceFromBox(boxPrice: number, piecesPerBox: number): number {
  return Math.round((boxPrice / Math.max(piecesPerBox, 1)) * 100) / 100;
}

export function splitBoxPieces(totalPieces: number, piecesPerBox: number) {
  const ppb = Math.max(piecesPerBox, 1);
  return {
    fullBoxes: Math.floor(totalPieces / ppb),
    loosePieces: totalPieces % ppb,
    piecesPerBox: ppb,
  };
}

export interface BillLinePricing {
  sellMode: SellMode;
  pieces: number;
  fullBoxes: number;
  loosePieces: number;
  boxes: number;
  kgQty?: number;
  kgPrice?: number;
  boxPrice: number;
  piecePrice: number;
  discount: number;
  subtotal: number;
  total: number;
}

export function normalizeSellInput(item: {
  sellMode?: SellMode;
  unitType?: "pieces" | "boxes" | "kg";
  quantity?: number;
  boxQty?: number;
  pieceQty?: number;
  kgQty?: number;
}): { sellMode: SellMode; boxQty: number; pieceQty: number; kgQty: number } {
  if (item.sellMode === "kg" || item.unitType === "kg") {
    return {
      sellMode: "kg",
      boxQty: 0,
      pieceQty: 0,
      kgQty: item.kgQty ?? item.quantity ?? 0,
    };
  }

  if (item.sellMode) {
    if (item.sellMode === "box") {
      return {
        sellMode: "box",
        boxQty: item.boxQty ?? item.quantity ?? 0,
        pieceQty: 0,
        kgQty: 0,
      };
    }
    if (item.sellMode === "piece") {
      return {
        sellMode: "piece",
        boxQty: 0,
        pieceQty: item.pieceQty ?? item.quantity ?? 0,
        kgQty: 0,
      };
    }
    return {
      sellMode: "mixed",
      boxQty: item.boxQty ?? 0,
      pieceQty: item.pieceQty ?? 0,
      kgQty: 0,
    };
  }

  if (item.unitType === "boxes") {
    return { sellMode: "box", boxQty: item.quantity ?? 0, pieceQty: 0, kgQty: 0 };
  }
  if (item.unitType === "pieces") {
    return { sellMode: "piece", boxQty: 0, pieceQty: item.quantity ?? 0, kgQty: 0 };
  }

  const kgQty = item.kgQty ?? 0;
  if (kgQty > 0) {
    return { sellMode: "kg", boxQty: 0, pieceQty: 0, kgQty };
  }

  /** New dispatch form sends boxQty / pieceQty without sellMode */
  const boxQty = item.boxQty ?? 0;
  const pieceQty = item.pieceQty ?? 0;
  if (boxQty > 0 && pieceQty > 0) {
    return { sellMode: "mixed", boxQty, pieceQty, kgQty: 0 };
  }
  if (boxQty > 0) {
    return { sellMode: "box", boxQty, pieceQty: 0, kgQty: 0 };
  }
  if (pieceQty > 0) {
    return { sellMode: "piece", boxQty: 0, pieceQty, kgQty: 0 };
  }

  return { sellMode: "piece", boxQty: 0, pieceQty: item.quantity ?? 0, kgQty: 0 };
}

export function inferSellMode(fullBoxes: number, loosePieces: number): SellMode {
  if (fullBoxes > 0 && loosePieces > 0) return "mixed";
  if (fullBoxes > 0) return "box";
  return "piece";
}

export function calculateBillLineTotal(params: {
  sellMode?: SellMode;
  unitType?: "pieces" | "boxes" | "kg";
  quantity?: number;
  boxQty?: number;
  pieceQty?: number;
  kgQty?: number;
  boxPrice: number;
  kgPrice?: number;
  piecesPerBox: number;
  discount?: number;
}): BillLinePricing {
  const ppb = Math.max(params.piecesPerBox, 1);
  const boxPrice = params.boxPrice;
  const piecePrice = piecePriceFromBox(boxPrice, ppb);
  const discount = params.discount || 0;

  const { sellMode, boxQty, pieceQty, kgQty } = normalizeSellInput(params);

  if (sellMode === "kg") {
    const kgPrice = params.kgPrice ?? boxPrice;
    const subtotal = kgQty * kgPrice;
    const total = Math.max(0, Math.round(subtotal - discount));
    return {
      sellMode: "kg",
      kgQty,
      kgPrice,
      pieces: kgQty,
      fullBoxes: 0,
      loosePieces: 0,
      boxes: 0,
      boxPrice,
      piecePrice: 0,
      discount,
      subtotal: Math.round(subtotal),
      total,
    };
  }

  let fullBoxes = 0;
  let loosePieces = 0;

  if (sellMode === "box") {
    fullBoxes = boxQty;
    loosePieces = 0;
  } else if (sellMode === "piece") {
    fullBoxes = 0;
    loosePieces = pieceQty;
  } else {
    fullBoxes = boxQty;
    loosePieces = pieceQty;
  }

  const pieces = fullBoxes * ppb + loosePieces;
  const subtotal = fullBoxes * boxPrice + loosePieces * piecePrice;
  const total = Math.max(0, Math.round(subtotal - discount));

  return {
    sellMode,
    pieces,
    fullBoxes,
    loosePieces,
    boxes: fullBoxes,
    boxPrice,
    piecePrice,
    discount,
    subtotal: Math.round(subtotal),
    total,
  };
}

/** Recompute line totals from stored item fields — fixes legacy wrong totals in DB */
export function enrichBillLineItem(item: {
  pieces: number;
  boxes?: number;
  fullBoxes?: number;
  loosePieces?: number;
  piecesPerBox?: number;
  unitPrice: number;
  piecePrice?: number;
  discount?: number;
  total?: number;
  sellMode?: SellMode;
  quantity?: number;
}): BillLinePricing {
  const ppb = Math.max(item.piecesPerBox || 1, 1);
  const boxPrice = item.unitPrice;
  const piecePrice = item.piecePrice ?? piecePriceFromBox(boxPrice, ppb);
  const discount = item.discount || 0;

  let fullBoxes: number;
  let loosePieces: number;

  if (item.sellMode === "kg") {
    const kgQty = item.quantity ?? item.pieces ?? 0;
    const kgPrice = item.unitPrice;
    const subtotal = kgQty * kgPrice;
    const total = Math.max(0, Math.round(subtotal - discount));
    return {
      sellMode: "kg",
      kgQty,
      kgPrice,
      pieces: kgQty,
      fullBoxes: 0,
      loosePieces: 0,
      boxes: 0,
      boxPrice: kgPrice,
      piecePrice: 0,
      discount,
      subtotal: Math.round(subtotal),
      total,
    };
  }

  if (item.sellMode === "box") {
    fullBoxes = item.fullBoxes ?? item.boxes ?? item.quantity ?? Math.floor(item.pieces / ppb);
    loosePieces = 0;
  } else if (item.sellMode === "piece") {
    fullBoxes = 0;
    loosePieces = item.loosePieces ?? item.quantity ?? item.pieces;
  } else {
    fullBoxes = item.fullBoxes ?? item.boxes ?? Math.floor(item.pieces / ppb);
    loosePieces = item.loosePieces ?? item.pieces % ppb;
  }

  const sellMode = item.sellMode ?? inferSellMode(fullBoxes, loosePieces);
  const subtotal = fullBoxes * boxPrice + loosePieces * piecePrice;
  const total = Math.max(0, Math.round(subtotal - discount));

  return {
    sellMode,
    pieces: fullBoxes * ppb + loosePieces,
    fullBoxes,
    loosePieces,
    boxes: fullBoxes,
    boxPrice,
    piecePrice,
    discount,
    subtotal: Math.round(subtotal),
    total,
  };
}

/** Box or Piece label for a bill line */
export function formatLineUnit(pricing: Pick<BillLinePricing, "sellMode" | "fullBoxes" | "loosePieces">): string {
  if (pricing.sellMode === "kg") return "Kg";
  if (pricing.sellMode === "box" || (pricing.fullBoxes > 0 && pricing.loosePieces === 0)) return "Box";
  if (pricing.sellMode === "piece" || (pricing.loosePieces > 0 && pricing.fullBoxes === 0)) return "Piece";
  return "Mixed";
}

/** Single rate string for one bill line (box OR piece, not both) */
export function formatLineRate(pricing: Pick<BillLinePricing, "sellMode" | "fullBoxes" | "loosePieces" | "boxPrice" | "piecePrice" | "kgPrice">): string {
  if (pricing.sellMode === "kg") {
    const rate = pricing.kgPrice ?? pricing.boxPrice;
    return `₹${rate.toLocaleString("en-IN")}/Kg`;
  }
  if (pricing.fullBoxes > 0 && pricing.loosePieces === 0) {
    return `₹${pricing.boxPrice.toLocaleString("en-IN")}/Box`;
  }
  if (pricing.loosePieces > 0 && pricing.fullBoxes === 0) {
    return `₹${pricing.piecePrice.toLocaleString("en-IN")}/Pc`;
  }
  const rates = formatRateDisplay(pricing.fullBoxes, pricing.loosePieces, pricing.boxPrice, pricing.piecePrice);
  return [rates.boxRate, rates.pieceRate].filter(Boolean).join(" · ") || "—";
}

/** Short detail line e.g. "2 Box × ₹1,200 = ₹2,400" */
export function formatLineDetail(pricing: BillLinePricing): string {
  const calc = formatBillLineCalculation(pricing);
  return `${calc} = ₹${pricing.total.toLocaleString("en-IN")}`;
}

export function formatQtyDisplay(fullBoxes: number, loosePieces: number, sellMode?: SellMode, kgQty?: number): string {
  if (sellMode === "kg" && kgQty !== undefined) {
    const rounded = Math.round(kgQty * 1000) / 1000;
    const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, "");
    return `${str} Kg`;
  }
  if (fullBoxes > 0 && loosePieces > 0) {
    return `${fullBoxes} Box + ${loosePieces} Pc`;
  }
  if (fullBoxes > 0) {
    return `${fullBoxes} Box${fullBoxes > 1 ? "es" : ""}`;
  }
  if (loosePieces > 0) {
    return `${loosePieces} Pc${loosePieces > 1 ? "s" : ""}`;
  }
  return "—";
}

export function formatPackDisplay(piecesPerBox: number): string {
  if (piecesPerBox <= 1) return "1 Pc";
  return `${piecesPerBox} Pcs/Box`;
}

export function formatBillLineCalculation(line: Pick<
  BillLinePricing,
  "sellMode" | "fullBoxes" | "loosePieces" | "boxPrice" | "piecePrice" | "kgQty" | "kgPrice"
>): string {
  if (line.sellMode === "kg" && line.kgQty !== undefined) {
    const rate = line.kgPrice ?? line.boxPrice;
    return `${line.kgQty} × ₹${rate.toLocaleString("en-IN")}`;
  }
  const parts: string[] = [];
  if (line.fullBoxes > 0) {
    parts.push(`${line.fullBoxes} × ₹${line.boxPrice.toLocaleString("en-IN")}`);
  }
  if (line.loosePieces > 0) {
    parts.push(`${line.loosePieces} × ₹${line.piecePrice.toLocaleString("en-IN")}`);
  }
  return parts.length > 0 ? parts.join(" + ") : "—";
}

export function formatRateDisplay(
  fullBoxes: number,
  loosePieces: number,
  boxPrice: number,
  piecePrice: number
): { boxRate?: string; pieceRate?: string } {
  const showBox = fullBoxes > 0;
  const showPiece = loosePieces > 0;
  return {
    boxRate: showBox ? `₹${boxPrice.toLocaleString("en-IN")}/Box` : undefined,
    pieceRate: showPiece ? `₹${piecePrice.toLocaleString("en-IN")}/Pc` : undefined,
  };
}

/** Split a combined box+piece line into separate box-only and piece-only rows for bill display */
export function expandItemForBillDisplay<T extends {
  productName: string;
  productCode?: string;
  pieces: number;
  boxes?: number;
  fullBoxes?: number;
  loosePieces?: number;
  piecesPerBox?: number;
  unitPrice: number;
  piecePrice?: number;
  discount?: number;
  total: number;
  calculation?: string;
}>(item: T): T[] {
  const pricing = enrichBillLineItem(item);
  const ppb = Math.max(item.piecesPerBox || 1, 1);

  if (pricing.fullBoxes > 0 && pricing.loosePieces > 0) {
    const boxSub = pricing.fullBoxes * pricing.boxPrice;
    const pieceSub = pricing.loosePieces * pricing.piecePrice;
    const totalSub = boxSub + pieceSub;
    const disc = item.discount || 0;
    const boxDisc = totalSub > 0 ? Math.round((disc * boxSub) / totalSub) : 0;
    const pieceDisc = disc - boxDisc;

    const boxLine = calculateBillLineTotal({
      sellMode: "box",
      boxQty: pricing.fullBoxes,
      boxPrice: pricing.boxPrice,
      piecesPerBox: ppb,
      discount: boxDisc,
    });
    const pieceLine = calculateBillLineTotal({
      sellMode: "piece",
      pieceQty: pricing.loosePieces,
      boxPrice: pricing.boxPrice,
      piecesPerBox: ppb,
      discount: pieceDisc,
    });

    return [
      {
        ...item,
        sellMode: "box" as const,
        pieces: boxLine.pieces,
        boxes: boxLine.fullBoxes,
        fullBoxes: boxLine.fullBoxes,
        loosePieces: 0,
        piecePrice: boxLine.piecePrice,
        discount: boxDisc,
        total: boxLine.total,
        calculation: formatBillLineCalculation(boxLine),
      },
      {
        ...item,
        sellMode: "piece" as const,
        pieces: pieceLine.pieces,
        boxes: 0,
        fullBoxes: 0,
        loosePieces: pieceLine.loosePieces,
        piecePrice: pieceLine.piecePrice,
        discount: pieceDisc,
        total: pieceLine.total,
        calculation: formatBillLineCalculation(pieceLine),
      },
    ];
  }

  return [
    {
      ...item,
      sellMode: pricing.sellMode,
      fullBoxes: pricing.fullBoxes,
      loosePieces: pricing.loosePieces,
      boxes: pricing.fullBoxes,
      pieces: pricing.pieces,
      piecePrice: pricing.piecePrice,
      total: pricing.total,
      calculation: item.calculation ?? formatBillLineCalculation(pricing),
    },
  ];
}

export function expandItemsForBillDisplay<T extends Parameters<typeof expandItemForBillDisplay>[0]>(
  items: T[]
): T[] {
  return items.flatMap((item) => expandItemForBillDisplay(item));
}

export function enrichDispatchBill<T extends {
  items?: Array<{
    productName?: string;
    productCode?: string;
    quantity?: number;
    pieces: number;
    boxes?: number;
    fullBoxes?: number;
    loosePieces?: number;
    piecesPerBox?: number;
    unitPrice: number;
    piecePrice?: number;
    discount?: number;
    total: number;
    sellMode?: SellMode;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  advance?: number;
  pending?: number;
}>(dispatch: T): T {
  const rawItems = dispatch.items ?? [];
  const enrichedItems = rawItems.map((item) => {
    const pricing = enrichBillLineItem(item);
    return {
      ...item,
      productName: item.productName ?? "",
      productCode: item.productCode ?? "",
      fullBoxes: pricing.fullBoxes,
      loosePieces: pricing.loosePieces,
      boxes: pricing.fullBoxes,
      pieces: pricing.pieces,
      piecePrice: pricing.piecePrice,
      sellMode: pricing.sellMode,
      total: pricing.total,
    };
  });

  const subtotal = enrichedItems.reduce((s, i) => s + i.total, 0);
  const discount = dispatch.discount || 0;
  const total = subtotal - discount;
  const advance = dispatch.advance ?? 0;
  const pending = Math.max(0, total - advance);

  return {
    ...dispatch,
    items: enrichedItems,
    subtotal,
    total,
    pending,
  };
}

export function enrichDispatchesList<T extends Parameters<typeof enrichDispatchBill>[0]>(
  dispatches: T[]
): T[] {
  return dispatches.map((d) => enrichDispatchBill(d));
}

/** Stock split for catalog / inventory (pieces stored in DB) */
export function getStockSplit(pieces: number, piecesPerBox: number) {
  return splitBoxPieces(pieces, piecesPerBox);
}

/** Product catalog: separate box and piece rates */
export function formatProductCatalogRates(boxPrice: number, piecesPerBox: number) {
  const piecePrice = piecePriceFromBox(boxPrice, piecesPerBox);
  return {
    piecePrice,
    boxRateLabel: `₹${boxPrice.toLocaleString("en-IN")}/Box`,
    pieceRateLabel: `₹${piecePrice.toLocaleString("en-IN")}/Pc`,
  };
}

/** One-line summary e.g. "Shuper Heavy — 2 Box @ ₹1,200/Box" */
export function formatBillItemSummary(
  item: Parameters<typeof enrichBillLineItem>[0] & { productName: string }
): string {
  const pricing = enrichBillLineItem(item);
  return `${item.productName} — ${formatQtyDisplay(pricing.fullBoxes, pricing.loosePieces)} @ ${formatLineRate(pricing)}`;
}

/** Map any stored line item to bill row shape */
export function toBillItemRow(item: {
  productName: string;
  productCode?: string;
  quantity?: number;
  pieces: number;
  boxes?: number;
  fullBoxes?: number;
  loosePieces?: number;
  piecesPerBox?: number;
  unitPrice: number;
  piecePrice?: number;
  discount?: number;
  total: number;
  sellMode?: SellMode;
}): {
  productName: string;
  productCode?: string;
  quantity?: number;
  pieces: number;
  boxes?: number;
  fullBoxes?: number;
  loosePieces?: number;
  piecesPerBox?: number;
  unitPrice: number;
  piecePrice?: number;
  discount?: number;
  total: number;
  sellMode?: SellMode;
} {
  const pricing = enrichBillLineItem(item);
  return {
    ...item,
    fullBoxes: pricing.fullBoxes,
    loosePieces: pricing.loosePieces,
    boxes: pricing.fullBoxes,
    pieces: pricing.pieces,
    piecePrice: pricing.piecePrice,
    sellMode: pricing.sellMode,
    total: pricing.total,
  };
}
