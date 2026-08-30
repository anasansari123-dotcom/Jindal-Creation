import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Product, InventoryTransaction, Order } from "@/lib/models";
import type { SessionUser } from "@/lib/auth/session";

import type { StockInputUnit } from "@/lib/product-units";
import { stockInputToStorage } from "@/lib/product-units";

export function piecesFromStockInput(
  quantity: number,
  stockUnit: StockInputUnit,
  piecesPerBox: number,
  sellingUnit?: string
): number {
  return stockInputToStorage(quantity, stockUnit, piecesPerBox, sellingUnit);
}

export function formatStockInNote(
  label: string,
  quantity: number,
  stockUnit: StockInputUnit,
  extraNotes?: string
): string {
  const unitLabel =
    stockUnit === "boxes" ? `${quantity} box` : stockUnit === "kg" ? `${quantity} kg` : `${quantity} pc`;
  const base = `${label}: ${unitLabel}`;
  return extraNotes?.trim() ? `${base} — ${extraNotes.trim()}` : base;
}

export async function adjustStock(
  productId: string,
  type: "STOCK_IN" | "ADJUSTMENT" | "RETURN" | "SALE",
  quantity: number,
  user: SessionUser,
  options?: { orderId?: string; notes?: string; session?: mongoose.ClientSession }
): Promise<void> {
  const session = options?.session;
  const product = session
    ? await Product.findById(productId).session(session)
    : await Product.findById(productId);

  if (!product) throw new Error("Product not found");

  const previousStock = product.currentStock;
  let newStock: number;

  if (type === "SALE") {
    newStock = previousStock - quantity;
  } else if (type === "ADJUSTMENT") {
    newStock = quantity;
  } else {
    newStock = previousStock + quantity;
  }

  const piecesPerBox = product.piecesPerBox || 1;
  const pieces = type === "ADJUSTMENT" ? newStock : quantity;
  const stockAdded = type === "STOCK_IN" || type === "RETURN" ? quantity : 0;
  const boxes =
    type === "STOCK_IN" || type === "RETURN"
      ? Math.floor(stockAdded / piecesPerBox)
      : Math.floor(pieces / piecesPerBox);

  product.currentStock = newStock;
  if (session) {
    await product.save({ session });
  } else {
    await product.save();
  }

  const transactionData = {
    productId: product._id,
    productName: product.name,
    productCode: product.productId,
    type,
    quantity: type === "ADJUSTMENT" ? Math.abs(newStock - previousStock) : quantity,
    pieces,
    boxes,
    previousStock,
    newStock,
    orderId: options?.orderId,
    notes: options?.notes,
    createdBy: user.id,
    createdByName: user.name,
  };

  if (session) {
    await InventoryTransaction.create([transactionData], { session });
  } else {
    await InventoryTransaction.create(transactionData);
  }
}

/** Multiple gadi/delivery stock-in on same day — each row = separate history entry */
export async function processStockInBatch(
  productId: string,
  deliveries: Array<{
    label?: string;
    quantity: number;
    stockUnit: StockInputUnit;
  }>,
  user: SessionUser,
  commonNotes?: string
): Promise<{ addedPieces: number; entries: number }> {
  await connectDB();
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  const ppb = product.piecesPerBox || 1;
  const sellingUnit = product.sellingUnit;
  let addedPieces = 0;

  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i];
    const pieces = piecesFromStockInput(d.quantity, d.stockUnit, ppb, sellingUnit);
    const label = d.label?.trim() || `Gadi ${i + 1}`;
    const note = formatStockInNote(label, d.quantity, d.stockUnit, commonNotes);
    await adjustStock(productId, "STOCK_IN", pieces, user, { notes: note });
    addedPieces += pieces;
  }

  return { addedPieces, entries: deliveries.length };
}

/** Deduct inventory when Confirm Bill is generated */
export async function confirmOrderInventory(
  orderId: string,
  user: SessionUser
): Promise<void> {
  await connectDB();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ orderId }).session(session);
    if (!order) throw new Error("Order not found");
    if (order.inventoryDeducted) {
      throw new Error("Stock has already been deducted for this order");
    }

    for (const item of order.items) {
      await adjustStock(
        item.productId.toString(),
        "SALE",
        item.pieces || item.quantity,
        user,
        { orderId: order.orderId, notes: `Confirm bill for order ${order.orderId}`, session }
      );
    }

    order.inventoryDeducted = true;
    order.status = "COMPLETED";
    order.confirmedAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
