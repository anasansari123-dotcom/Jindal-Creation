import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  productId: string;
  name: string;
  category: string;
  description?: string;
  unit: string;
  /** Default selling unit: box, piece, or kg */
  sellingUnit: "box" | "piece" | "kg";
  price: number;
  costPrice: number;
  /** Box price (₹ per box) */
  sellingPrice: number;
  piecesPerBox: number;
  minimumStock: number;
  /** Total stock in pieces (base unit) */
  currentStock: number;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    /** Human-readable product number — may repeat across products */
    productId: { type: String, required: true, trim: true },
    /** Product name — may repeat; use category + number to tell items apart */
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    unit: { type: String, required: true, default: "Piece" },
    sellingUnit: { type: String, enum: ["box", "piece", "kg"], default: "box" },
    price: { type: Number, required: true, default: 0 },
    costPrice: { type: Number, required: true, default: 0 },
    sellingPrice: { type: Number, required: true, default: 0 },
    piecesPerBox: { type: Number, required: true, default: 1 },
    minimumStock: { type: Number, required: true, default: 10 },
    currentStock: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

ProductSchema.index({ name: 1 });
ProductSchema.index({ productId: 1 });
ProductSchema.index({ name: "text", productId: "text", category: "text" });
ProductSchema.index({ category: 1 });

export const Product: Model<IProduct> =
  mongoose.models.Product ||
  mongoose.model<IProduct>("Product", ProductSchema);
