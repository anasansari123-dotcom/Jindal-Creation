import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { InventoryTransactionType } from "@/lib/constants";

export interface IInventoryTransaction extends Document {
  productId: Types.ObjectId;
  productName: string;
  productCode: string;
  type: InventoryTransactionType;
  quantity: number;
  pieces: number;
  boxes: number;
  previousStock: number;
  newStock: number;
  orderId?: string;
  notes?: string;
  /** Sold more than available stock (no prior purchase) */
  soldWithoutPurchase?: boolean;
  /** Qty sold without stock at time of sale */
  shortfallQty?: number;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
}

const InventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productCode: { type: String, required: true },
    type: {
      type: String,
      enum: ["STOCK_IN", "SALE", "ADJUSTMENT", "RETURN"],
      required: true,
    },
    quantity: { type: Number, required: true },
    pieces: { type: Number, required: true, default: 0 },
    boxes: { type: Number, default: 0 },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    orderId: { type: String },
    notes: { type: String },
    soldWithoutPurchase: { type: Boolean, default: false },
    shortfallQty: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InventoryTransactionSchema.index({ productId: 1 });
InventoryTransactionSchema.index({ orderId: 1 });
InventoryTransactionSchema.index({ createdAt: -1 });
InventoryTransactionSchema.index({ soldWithoutPurchase: 1, createdAt: -1 });

export const InventoryTransaction: Model<IInventoryTransaction> =
  mongoose.models.InventoryTransaction ||
  mongoose.model<IInventoryTransaction>(
    "InventoryTransaction",
    InventoryTransactionSchema
  );
