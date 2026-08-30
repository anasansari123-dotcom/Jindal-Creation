import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IPaymentAllocation {
  billRef: Types.ObjectId;
  billSource: "Order" | "Dispatch" | "ConfirmBill";
  billCode: string;
  billType: string;
  amount: number;
}

export interface IPayment extends Document {
  paymentId: string;
  orderId?: Types.ObjectId;
  orderCode?: string;
  customerId: Types.ObjectId;
  customerName: string;
  amount: number;
  date: Date;
  method: string;
  referenceNumber?: string;
  addedBy: Types.ObjectId;
  addedByName: string;
  notes?: string;
  /** FIFO breakdown — which bills received how much */
  allocations: IPaymentAllocation[];
  /** Surplus stored as customer advance credit */
  creditAdded: number;
  createdAt: Date;
}

const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    billRef: { type: Schema.Types.ObjectId, required: true },
    billSource: { type: String, enum: ["Order", "Dispatch", "ConfirmBill"], required: true },
    billCode: { type: String, required: true },
    billType: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    orderCode: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    method: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"],
      required: true,
    },
    referenceNumber: { type: String },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    addedByName: { type: String, required: true },
    notes: { type: String },
    allocations: { type: [PaymentAllocationSchema], default: [] },
    creditAdded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ date: -1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", PaymentSchema);
