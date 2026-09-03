import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { SellMode } from "@/lib/bill-pricing";

export interface IProductReturnItem {
  productId?: Types.ObjectId;
  productName: string;
  productCode: string;
  soldPieces: number;
  returnPieces: number;
  sellMode?: SellMode;
  unitPrice: number;
  lineReturnAmount: number;
  reason?: string;
}

export interface IProductReturn extends Document {
  returnId: string;
  dispatchMongoId: Types.ObjectId;
  dispatchId: string;
  finalBillId?: string;
  customerId?: Types.ObjectId;
  customerName: string;
  customerCode?: string;
  items: IProductReturnItem[];
  refundAmount: number;
  refundMethod: "credit" | "cash" | "adjust_pending";
  refundMethodDetail?: string;
  status: "COMPLETED" | "CANCELLED";
  notes?: string;
  returnDate: Date;
  processedBy: Types.ObjectId;
  processedByName: string;
  createdAt: Date;
}

const ProductReturnItemSchema = new Schema<IProductReturnItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    productCode: { type: String, required: true },
    soldPieces: { type: Number, required: true },
    returnPieces: { type: Number, required: true, min: 0.01 },
    sellMode: { type: String, enum: ["box", "piece", "mixed", "kg"] },
    unitPrice: { type: Number, required: true },
    lineReturnAmount: { type: Number, required: true },
    reason: { type: String },
  },
  { _id: false }
);

const ProductReturnSchema = new Schema<IProductReturn>(
  {
    returnId: { type: String, required: true, unique: true },
    dispatchMongoId: { type: Schema.Types.ObjectId, ref: "Dispatch", required: true },
    dispatchId: { type: String, required: true },
    finalBillId: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, required: true },
    customerCode: { type: String },
    items: { type: [ProductReturnItemSchema], required: true },
    refundAmount: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      enum: ["credit", "cash", "adjust_pending"],
      required: true,
    },
    refundMethodDetail: { type: String },
    status: { type: String, enum: ["COMPLETED", "CANCELLED"], default: "COMPLETED" },
    notes: { type: String },
    returnDate: { type: Date, required: true, default: Date.now },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    processedByName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProductReturnSchema.index({ returnId: 1 });
ProductReturnSchema.index({ dispatchMongoId: 1 });
ProductReturnSchema.index({ dispatchId: 1 });
ProductReturnSchema.index({ customerId: 1 });
ProductReturnSchema.index({ returnDate: -1 });
ProductReturnSchema.index({ status: 1 });

export const ProductReturn: Model<IProductReturn> =
  mongoose.models.ProductReturn ||
  mongoose.model<IProductReturn>("ProductReturn", ProductReturnSchema);
