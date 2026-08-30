import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { OrderStatus, PaymentStatus } from "@/lib/constants";

export interface IOrderItem {
  productId: Types.ObjectId;
  productName: string;
  productCode: string;
  quantity: number;
  pieces: number;
  boxes: number;
  unitPrice: number;
  discount: number;
  total: number;
  productVerified?: boolean;
  quantityVerified?: boolean;
  priceVerified?: boolean;
}

export interface IOrder extends Document {
  orderId: string;
  customerId: Types.ObjectId;
  customerName: string;
  customerCode: string;
  orderDate: Date;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  advance: number;
  pending: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  salespersonId: Types.ObjectId;
  salespersonName: string;
  notes?: string;
  status: OrderStatus;
  inventoryDeducted: boolean;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verifiedByName?: string;
  dispatchedAt?: Date;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productCode: { type: String, required: true },
    quantity: { type: Number, required: true },
    pieces: { type: Number, required: true, default: 0 },
    boxes: { type: Number, default: 0 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    productVerified: { type: Boolean, default: false },
    quantityVerified: { type: Boolean, default: false },
    priceVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    customerCode: { type: String, required: true },
    orderDate: { type: Date, required: true, default: Date.now },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    advance: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
    },
    salespersonId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    salespersonName: { type: String, required: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "VERIFIED", "DISPATCHED", "COMPLETED"],
      default: "PENDING",
    },
    inventoryDeducted: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedByName: { type: String },
    dispatchedAt: { type: Date },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

OrderSchema.index({ orderId: 1 });
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ orderDate: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderId: "text", customerName: "text" });

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
