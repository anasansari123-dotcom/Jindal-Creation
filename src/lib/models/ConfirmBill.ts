import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { IOrderItem } from "./Order";

export interface IConfirmBill extends Document {
  confirmBillId: string;
  orderId: Types.ObjectId;
  orderCode: string;
  customerId: Types.ObjectId;
  customerName: string;
  customerCode: string;
  items: IOrderItem[];
  confirmDate: Date;
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  confirmedBy: Types.ObjectId;
  confirmedByName: string;
  salespersonName: string;
  inventoryDeducted: boolean;
  createdAt: Date;
}

const ConfirmBillSchema = new Schema<IConfirmBill>(
  {
    confirmBillId: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderCode: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    customerCode: { type: String, required: true },
    items: [{ type: Schema.Types.Mixed }],
    confirmDate: { type: Date, required: true, default: Date.now },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    advance: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    paymentStatus: { type: String, required: true },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    confirmedByName: { type: String, required: true },
    salespersonName: { type: String, required: true },
    inventoryDeducted: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ConfirmBillSchema.index({ orderId: 1 });
ConfirmBillSchema.index({ customerId: 1 });
ConfirmBillSchema.index({ confirmBillId: 1 });
ConfirmBillSchema.index({ confirmDate: -1 });

export const ConfirmBill: Model<IConfirmBill> =
  mongoose.models.ConfirmBill ||
  mongoose.model<IConfirmBill>("ConfirmBill", ConfirmBillSchema);
