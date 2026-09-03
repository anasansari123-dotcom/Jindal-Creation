import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICustomer extends Document {
  customerId: string;
  name: string;
  companyName?: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  notes?: string;
  /** Surplus payment credit — auto-applied on next bills or shown as advance */
  creditBalance: number;
  /** Account documents on Cloudinary (GST, ID, agreements, etc.) */
  documents?: Array<{
    label: string;
    url: string;
    publicId: string;
    uploadedAt: Date;
  }>;
  /** Saved bill PDF / photo from Cloudinary */
  billFiles?: Array<{
    label: string;
    url: string;
    publicId: string;
    fileType: "bill-pdf" | "bill-image" | "load-photo" | "dispatch-bill-pdf" | "dispatch-bill-image";
    billId: string;
    dispatchMongoId: Types.ObjectId;
    uploadedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
    creditBalance: { type: Number, default: 0, min: 0 },
    documents: {
      type: [
        {
          label: { type: String, required: true },
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    billFiles: {
      type: [
        {
          label: { type: String, required: true },
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          fileType: {
            type: String,
            enum: ["bill-pdf", "bill-image", "load-photo", "dispatch-bill-pdf", "dispatch-bill-image"],
            required: true,
          },
          billId: { type: String, required: true },
          dispatchMongoId: { type: Schema.Types.ObjectId, ref: "Dispatch", required: true },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

CustomerSchema.index({ customerId: 1 });
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ name: "text", companyName: "text", customerId: "text" });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", CustomerSchema);
