import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { SellMode } from "@/lib/bill-pricing";

export interface IDispatchItem {
  productId?: Types.ObjectId;
  productName: string;
  productCode: string;
  quantity: number;
  pieces: number;
  boxes: number;
  piecesPerBox?: number;
  /** Box rate (₹ per box) */
  unitPrice: number;
  piecePrice?: number;
  fullBoxes?: number;
  loosePieces?: number;
  sellMode?: SellMode;
  discount: number;
  total: number;
}

export interface IDispatch extends Document {
  dispatchId: string;
  billStatus: "DISPATCH" | "FINAL";
  orderId?: Types.ObjectId;
  orderCode?: string;
  customerId?: Types.ObjectId;
  customerName: string;
  customerCode?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  items: IDispatchItem[];
  dispatchDate: Date;
  /** immediate = normal bill; advance = customer paid advance, maal ready-by date par */
  orderType: "immediate" | "advance";
  readyByDate?: Date;
  subtotal: number;
  discount: number;
  /** Current bill items total after discount (excludes carried-forward pending) */
  currentBillAmount?: number;
  /** Previous bills' pending rolled into this bill */
  carriedForwardPending?: number;
  /** Account credit/advance applied from customer balance */
  creditApplied?: number;
  /** Overpayment added to customer account advance */
  creditAdded?: number;
  /** Actual cash/UPI amount customer paid (may exceed bill total → creditAdded) */
  cashPaid?: number;
  total: number;
  advance: number;
  pending: number;
  paymentStatus: string;
  paymentMode?: string;
  inventoryDeducted: boolean;
  verifiedBy: Types.ObjectId;
  verifiedByName: string;
  salespersonName: string;
  notes?: string;
  /** Gadi / vehicle load photo — Cloudinary URL, shown on Final Bill */
  loadPhotoUrl?: string;
  loadPhotoPublicId?: string;
  /** Archived bill PDF on Cloudinary */
  billPdfUrl?: string;
  billPdfPublicId?: string;
  /** Archived bill PNG (WhatsApp share) on Cloudinary */
  billImageUrl?: string;
  billImagePublicId?: string;
  finalBillId?: string;
  convertedAt?: Date;
  statusHistory?: Array<{
    status: "PENDING" | "COMPLETED";
    billStatus: "DISPATCH" | "FINAL";
    date: Date;
    note: string;
    byName: string;
  }>;
  createdAt: Date;
}

const DispatchItemSchema = new Schema<IDispatchItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    productCode: { type: String, required: true },
    quantity: { type: Number, required: true },
    pieces: { type: Number, required: true, default: 0 },
    boxes: { type: Number, default: 0 },
    piecesPerBox: { type: Number },
    unitPrice: { type: Number, required: true },
    piecePrice: { type: Number },
    fullBoxes: { type: Number, default: 0 },
    loosePieces: { type: Number, default: 0 },
    sellMode: { type: String, enum: ["box", "piece", "mixed", "kg"] },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const DispatchSchema = new Schema<IDispatch>(
  {
    dispatchId: { type: String, required: true, unique: true },
    billStatus: { type: String, enum: ["DISPATCH", "FINAL"], default: "DISPATCH" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    orderCode: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, required: true },
    customerCode: { type: String },
    customerCompany: { type: String },
    customerPhone: { type: String },
    customerAddress: { type: String },
    customerCity: { type: String },
    items: [DispatchItemSchema],
    dispatchDate: { type: Date, required: true, default: Date.now },
    orderType: { type: String, enum: ["immediate", "advance"], default: "immediate" },
    readyByDate: { type: Date },
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    currentBillAmount: { type: Number, default: 0 },
    carriedForwardPending: { type: Number, default: 0 },
    creditApplied: { type: Number, default: 0 },
    creditAdded: { type: Number, default: 0 },
    cashPaid: { type: Number, default: 0 },
    total: { type: Number, required: true },
    advance: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    paymentStatus: { type: String, required: true, default: "UNPAID" },
    paymentMode: { type: String },
    inventoryDeducted: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    verifiedByName: { type: String, required: true },
    salespersonName: { type: String, required: true },
    notes: { type: String },
    loadPhotoUrl: { type: String },
    loadPhotoPublicId: { type: String },
    billPdfUrl: { type: String },
    billPdfPublicId: { type: String },
    billImageUrl: { type: String },
    billImagePublicId: { type: String },
    finalBillId: { type: String },
    convertedAt: { type: Date },
    statusHistory: {
      type: [
        {
          status: { type: String, enum: ["PENDING", "COMPLETED"], required: true },
          billStatus: { type: String, enum: ["DISPATCH", "FINAL"], required: true },
          date: { type: Date, required: true },
          note: { type: String, required: true },
          byName: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

DispatchSchema.index({ dispatchId: 1 });
DispatchSchema.index({ billStatus: 1 });
DispatchSchema.index({ dispatchDate: -1 });
DispatchSchema.index({ customerId: 1 });
DispatchSchema.index({ orderId: 1 });
DispatchSchema.index({ billStatus: 1, inventoryDeducted: 1 });
DispatchSchema.index({ orderType: 1, readyByDate: 1 });

export const Dispatch: Model<IDispatch> =
  mongoose.models.Dispatch ||
  mongoose.model<IDispatch>("Dispatch", DispatchSchema);
