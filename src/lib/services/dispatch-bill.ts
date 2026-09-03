import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Product, InventoryTransaction, Dispatch, Customer } from "@/lib/models";
import type { SessionUser } from "@/lib/auth/session";
import type { IDispatchItem } from "@/lib/models/Dispatch";
import { calculateBillLineTotal, enrichBillLineItem, looseShortfallQty, normalizeSellInput } from "@/lib/bill-pricing";
import { customerNamesMatch } from "@/lib/customer-bills";
import { generateCustomerId } from "@/lib/generators";
import { logActivity } from "@/lib/activity";

/** Copy canonical customer fields onto a dispatch bill */
export function applyCustomerToDispatch(
  dispatch: InstanceType<typeof Dispatch>,
  customer: InstanceType<typeof Customer>
) {
  dispatch.customerId = customer._id;
  dispatch.customerName = customer.name;
  dispatch.customerCode = customer.customerId;
  dispatch.customerCompany = customer.companyName || dispatch.customerCompany;
  dispatch.customerPhone = customer.phone || dispatch.customerPhone;
  dispatch.customerAddress = customer.address || dispatch.customerAddress;
  dispatch.customerCity = customer.city || dispatch.customerCity;
}

/** Link walk-in dispatch to customer record — at create or final bill */
export async function linkDispatchToCustomer(
  dispatch: InstanceType<typeof Dispatch>,
  user: SessionUser,
  options?: { createIfMissing?: boolean }
): Promise<void> {
  if (dispatch.customerId) {
    const linked = await Customer.findById(dispatch.customerId);
    if (linked && customerNamesMatch(dispatch.customerName, linked.name)) {
      applyCustomerToDispatch(dispatch, linked);
    }
    await dispatch.save();
    return;
  }

  const name = dispatch.customerName?.trim();
  if (!name) {
    throw new Error("Customer name required hai");
  }

  const phone = dispatch.customerPhone?.trim();
  if (phone && phone.length >= 10) {
    const existing = await Customer.findOne({ phone });
    // Same phone ≠ same customer — only link when names also match
    if (existing && customerNamesMatch(name, existing.name)) {
      applyCustomerToDispatch(dispatch, existing);
      await dispatch.save();
      return;
    }
  }

  if (options?.createIfMissing === false) return;

  const customerCode = await generateCustomerId();
  const walkInPhone =
    phone && phone.length >= 10
      ? phone
      : `W${customerCode.replace(/\D/g, "").padStart(9, "0").slice(-9)}`;

  const customer = await Customer.create({
    customerId: customerCode,
    name,
    companyName: dispatch.customerCompany,
    phone: walkInPhone,
    address: dispatch.customerAddress,
    city: dispatch.customerCity,
    notes: `Auto-linked from bill ${dispatch.dispatchId}`,
  });

  applyCustomerToDispatch(dispatch, customer);
  await dispatch.save();

  await logActivity(
    user,
    "Customer Created",
    `Customer ${name} (${customerCode}) linked to bill ${dispatch.dispatchId}`,
    customerCode,
    "customer"
  );
}

/** Fix bills wrongly linked to a customer (e.g. same phone, different name) */
export async function repairMislinkedDispatches(user: SessionUser) {
  const dispatches = await Dispatch.find({ customerId: { $exists: true, $ne: null } });
  let repaired = 0;

  for (const dispatch of dispatches) {
    const customer = await Customer.findById(dispatch.customerId);
    if (!customer) continue;
    if (customerNamesMatch(dispatch.customerName, customer.name)) continue;

    dispatch.customerId = undefined;
    dispatch.customerCode = undefined;
    await dispatch.save();
    await linkDispatchToCustomer(dispatch, user, { createIfMissing: true });
    repaired += 1;
  }

  return repaired;
}

/** Walk-in bills: auto-link or create customer before Final Bill */
export async function ensureCustomerForFinalBill(
  dispatch: InstanceType<typeof Dispatch>,
  user: SessionUser
): Promise<void> {
  await linkDispatchToCustomer(dispatch, user, { createIfMissing: true });
}

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

      const pricing = enrichBillLineItem({
        pieces: item.pieces || item.quantity || 0,
        boxes: item.boxes,
        fullBoxes: item.fullBoxes,
        loosePieces: item.loosePieces,
        piecesPerBox: product.piecesPerBox,
        unitPrice: item.unitPrice,
        sellMode: item.sellMode,
        quantity: item.quantity,
      });
      const qty = pricing.pieces;
      const previousStock = product.currentStock;
      const newStock = previousStock - qty;
      const shortfallTotal = Math.max(0, qty - Math.max(0, previousStock));
      const shortfallQty = looseShortfallQty(shortfallTotal, {
        pieces: pricing.pieces,
        boxes: pricing.fullBoxes,
        fullBoxes: pricing.fullBoxes,
        loosePieces: pricing.loosePieces,
        piecesPerBox: product.piecesPerBox,
        sellMode: pricing.sellMode,
        quantity: item.quantity,
      });
      const soldWithoutPurchase = shortfallTotal > 0;

      product.currentStock = newStock;
      await product.save({ session });

      const noteSuffix = soldWithoutPurchase
        ? shortfallQty > 0
          ? ` — bina purchase ${shortfallQty} loose sell`
          : ` — bina purchase ${shortfallTotal} sell (boxes)`
        : "";
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
          notes: `Final bill ${finalBillId} — ${dispatch.customerName}${noteSuffix}`,
          soldWithoutPurchase,
          shortfallQty,
          createdBy: user.id,
          createdByName: user.name,
        }],
        { session }
      );
    }

    const convertedAt = dispatch.convertedAt || new Date();
    if (!isRetry) {
      if (dispatch.billPdfUrl && !dispatch.dispatchBillPdfUrl) {
        dispatch.dispatchBillPdfUrl = dispatch.billPdfUrl;
        dispatch.dispatchBillPdfPublicId = dispatch.billPdfPublicId;
      }
      if (dispatch.billImageUrl && !dispatch.dispatchBillImageUrl) {
        dispatch.dispatchBillImageUrl = dispatch.billImageUrl;
        dispatch.dispatchBillImagePublicId = dispatch.billImagePublicId;
      }
    }
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
  pieceUnitPrice?: number;
  kgUnitPrice?: number;
};

function expandRawItems(rawItems: RawDispatchItem[]): Array<RawDispatchItem & { sellMode: "box" | "piece" | "kg" }> {
  const expanded: Array<RawDispatchItem & { sellMode: "box" | "piece" | "kg" }> = [];

  for (const item of rawItems) {
    const normalized = normalizeSellInput(item);
    const boxQty = normalized.boxQty;
    const pieceQty = normalized.pieceQty;
    const kgQty = normalized.kgQty;
    if (normalized.sellMode === "kg" && kgQty > 0) {
      expanded.push({ ...item, sellMode: "kg", kgQty, boxQty: 0, pieceQty: 0, itemDiscount: 0 });
    } else if (boxQty > 0 && pieceQty > 0) {
      expanded.push({ ...item, sellMode: "box", boxQty, pieceQty: 0, itemDiscount: 0 });
      expanded.push({ ...item, sellMode: "piece", boxQty: 0, pieceQty, itemDiscount: 0 });
    } else if (boxQty > 0) {
      expanded.push({ ...item, sellMode: "box", boxQty, pieceQty: 0, itemDiscount: 0 });
    } else if (pieceQty > 0) {
      expanded.push({ ...item, sellMode: "piece", boxQty: 0, pieceQty, itemDiscount: 0 });
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
  /** @deprecated Stock check removed — Tally-style: sell allowed without purchase (negative stock) */
  skipStockCheck?: boolean
): IDispatchItem[] {
  const expanded = expandRawItems(rawItems);
  if (expanded.length === 0) {
    throw new Error("Add at least one product with box, piece, or kg quantity");
  }

  void previousItems;
  void skipStockCheck;

  return expanded.map((item) => {
    const product = products.find((p) => p._id?.toString() === item.productId)!;
    const piecesPerBox = Math.max(product.piecesPerBox || 1, 1);
    const boxPrice = item.unitPrice ?? product.sellingPrice;
    const pieceUnitPrice = item.pieceUnitPrice;
    const kgUnitPrice = item.kgUnitPrice ?? item.unitPrice;
    const { sellMode, boxQty, pieceQty, kgQty } = normalizeSellInput(item);

    const pricing = calculateBillLineTotal({
      sellMode,
      boxQty,
      pieceQty,
      kgQty,
      boxPrice: sellMode === "kg" ? (kgUnitPrice ?? product.sellingPrice) : boxPrice,
      piecePrice: pieceUnitPrice,
      kgPrice: kgUnitPrice ?? product.sellingPrice,
      piecesPerBox,
      discount: 0,
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
      unitPrice: sellMode === "kg" ? (kgUnitPrice ?? product.sellingPrice) : boxPrice,
      piecePrice: pricing.piecePrice,
      fullBoxes: pricing.fullBoxes,
      loosePieces: pricing.loosePieces,
      sellMode: pricing.sellMode,
      discount: 0,
      total: pricing.total,
    };
  });
}
