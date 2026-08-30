import mongoose, { Schema, Document, Model } from "mongoose";

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
