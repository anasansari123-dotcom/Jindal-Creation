import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Product, InventoryTransaction, Dispatch } from "@/lib/models";
import type { SessionUser } from "@/lib/auth/session";
import type { IDispatchItem } from "@/lib/models/Dispatch";
import { calculateBillLineTotal, normalizeSellInput } from "@/lib/bill-pricing";

/** Clamp bill total so discount never makes it negative */
export function computeBillTotals(subtotal: number, discount: number) {
  const safeDiscount = Math.max(0, discount);
  const total = Math.max(0, subtotal - safeDiscount);
  return { subtotal, discount: safeDiscount, total };
}

/**
 * Atomically deduct stock and mark dispatch as FINAL.
 * Supports retry when bill is FINAL but inventoryDeducted is false.
 */
export async function finalizeDispatchBill(
  dispatchMongoId: string,
  finalBillId: string,
  user: SessionUser
): Promise<InstanceType<typeof Dispatch>> {
  await connectDB();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispatch = await Dispatch.findById(dispatchMongoId).session(session);
    if (!dispatch) throw new Error("Dispatch bill not found");

    if (dispatch.inventoryDeducted) {
      throw new Error("Stock already deducted for this bill");
    }

    const isRetry = dispatch.billStatus === "FINAL";
    if (!isRetry && dispatch.billStatus !== "DISPATCH") {
      throw new Error("Invalid bill status for final conversion");
    }

    for (const item of dispatch.items) {
      if (!item.productId) continue;
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product not found: ${item.productName}`);

      const qty = item.pieces || item.quantity;
      const previousStock = product.currentStock;
      const newStock = previousStock - qty;
      if (newStock < 0) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${previousStock}, Required: ${qty}`
        );
      }

      product.currentStock = newStock;
      await product.save({ session });

      await InventoryTransaction.create(
        [{
          productId: product._id,
          productName: product.name,
          productCode: product.productId,
          type: "SALE",
          quantity: qty,
          pieces: item.pieces,
          boxes: item.boxes,
          previousStock,
          newStock,
          orderId: dispatch.dispatchId,
          notes: `Final bill ${finalBillId} — ${dispatch.customerName}`,
          createdBy: user.id,
          createdByName: user.name,
        }],
        { session }
      );
    }

    const convertedAt = dispatch.convertedAt || new Date();
    dispatch.billStatus = "FINAL";
    dispatch.finalBillId = finalBillId;
    dispatch.convertedAt = convertedAt;
    dispatch.inventoryDeducted = true;
    if (!dispatch.statusHistory) dispatch.statusHistory = [];
    if (!isRetry) {
      dispatch.statusHistory.push({
        status: "COMPLETED",
        billStatus: "FINAL",
        date: convertedAt,
        note: `Final bill ${finalBillId} — order complete, stock minus`,
        byName: user.name,
      });
    }
    await dispatch.save({ session });
    await session.commitTransaction();
    return dispatch;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/** @deprecated Use finalizeDispatchBill — kept for legacy callers */
export async function deductDispatchInventory(
  dispatchId: string,
  user: SessionUser
): Promise<void> {
  await connectDB();
  const dispatch = await Dispatch.findOne({ dispatchId });
  if (!dispatch) throw new Error("Dispatch bill not found");
  await finalizeDispatchBill(String(dispatch._id), dispatch.finalBillId || dispatch.dispatchId, user);
}

type RawDispatchItem = {
  productId: string;
  sellMode?: "box" | "piece" | "mixed" | "kg";
  unitType?: "pieces" | "boxes" | "kg";
  quantity?: number;
  boxQty?: number;
  pieceQty?: number;
  kgQty?: number;
  boxDiscount?: number;
  pieceDiscount?: number;
  kgDiscount?: number;
  itemDiscount?: number;
  unitPrice?: number;
};

function expandRawItems(rawItems: RawDispatchItem[]): Array<RawDispatchItem & { sellMode: "box" | "piece" | "kg" }> {
  const expanded: Array<RawDispatchItem & { sellMode: "box" | "piece" | "kg" }> = [];

  for (const item of rawItems) {
    const normalized = normalizeSellInput(item);
    const boxQty = normalized.boxQty;
    const pieceQty = normalized.pieceQty;
    const kgQty = normalized.kgQty;
    const boxDiscount =
      item.boxDiscount ?? (normalized.sellMode === "piece" || normalized.sellMode === "kg" ? 0 : item.itemDiscount ?? 0);
    const pieceDiscount =
      item.pieceDiscount ?? (normalized.sellMode === "box" || normalized.sellMode === "kg" ? 0 : item.itemDiscount ?? 0);
    const kgDiscount =
      item.kgDiscount ?? (normalized.sellMode === "box" || normalized.sellMode === "piece" ? 0 : item.itemDiscount ?? 0);

    if (normalized.sellMode === "kg" && kgQty > 0) {
      expanded.push({ ...item, sellMode: "kg", kgQty, boxQty: 0, pieceQty: 0, itemDiscount: kgDiscount });
    } else if (boxQty > 0 && pieceQty > 0) {
      expanded.push({ ...item, sellMode: "box", boxQty, pieceQty: 0, itemDiscount: boxDiscount });
      expanded.push({ ...item, sellMode: "piece", boxQty: 0, pieceQty, itemDiscount: pieceDiscount });
    } else if (boxQty > 0) {
      expanded.push({ ...item, sellMode: "box", boxQty, pieceQty: 0, itemDiscount: boxDiscount });
    } else if (pieceQty > 0) {
      expanded.push({ ...item, sellMode: "piece", boxQty: 0, pieceQty, itemDiscount: pieceDiscount });
    }
  }

  return expanded;
}

export function buildDispatchItems(
  rawItems: RawDispatchItem[],
  products: Array<{
    _id: unknown;
    productId: string;
    name: string;
    piecesPerBox: number;
    sellingPrice: number;
    currentStock: number;
    sellingUnit?: string;
  }>,
  /** When editing, add back pieces already on this bill before stock check */
  previousItems?: Array<{ productId?: unknown; pieces: number }>,
  /** Advance booking — stock check skip (deduct at final bill) */
  skipStockCheck?: boolean
): IDispatchItem[] {
  const expanded = expandRawItems(rawItems);
  if (expanded.length === 0) {
    throw new Error("Add at least one product with box, piece, or kg quantity");
  }

  const previousPieces = new Map<string, number>();
  for (const item of previousItems ?? []) {
    if (!item.productId) continue;
    const pid = String(item.productId);
    previousPieces.set(pid, (previousPieces.get(pid) || 0) + (item.pieces || 0));
  }

  const piecesNeeded = new Map<string, number>();

  for (const item of expanded) {
    const product = products.find((p) => p._id?.toString() === item.productId);
    if (!product) throw new Error("Product not found");

    const piecesPerBox = Math.max(product.piecesPerBox || 1, 1);
    const { sellMode, boxQty, pieceQty, kgQty } = normalizeSellInput(item);
    const pieces =
      sellMode === "kg"
        ? kgQty
        : sellMode === "box"
          ? boxQty * piecesPerBox
          : pieceQty;

    const prev = piecesNeeded.get(item.productId) || 0;
    piecesNeeded.set(item.productId, prev + pieces);
  }

  for (const [productId, needed] of piecesNeeded) {
    if (skipStockCheck) continue;
    const product = products.find((p) => p._id?.toString() === productId);
    if (product) {
      const available = product.currentStock + (previousPieces.get(productId) || 0);
      if (available < needed) {
        const unit = product.sellingUnit === "kg" ? "kg" : "pcs";
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${available} ${unit}, Required: ${needed} ${unit}`
        );
      }
    }
  }

  return expanded.map((item) => {
    const product = products.find((p) => p._id?.toString() === item.productId)!;
    const piecesPerBox = Math.max(product.piecesPerBox || 1, 1);
    const boxPrice = product.sellingPrice;
    const itemDiscount = item.itemDiscount || 0;
    const { sellMode, boxQty, pieceQty, kgQty } = normalizeSellInput(item);

    const pricing = calculateBillLineTotal({
      sellMode,
      boxQty,
      pieceQty,
      kgQty,
      boxPrice,
      piecesPerBox,
      discount: itemDiscount,
    });

    const inputQty =
      sellMode === "kg" ? kgQty : sellMode === "box" ? boxQty : pieceQty;

    return {
      productId: product._id as mongoose.Types.ObjectId,
      productName: product.name,
      productCode: product.productId,
      quantity: inputQty,
      pieces: pricing.pieces,
      boxes: pricing.fullBoxes,
      piecesPerBox,
      unitPrice: boxPrice,
      piecePrice: pricing.piecePrice,
      fullBoxes: pricing.fullBoxes,
      loosePieces: pricing.loosePieces,
      sellMode: pricing.sellMode,
      discount: itemDiscount,
      total: pricing.total,
    };
  });
}
