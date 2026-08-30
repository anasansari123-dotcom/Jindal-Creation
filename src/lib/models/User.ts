import mongoose, { Schema, Document, Model } from "mongoose";
import type { Permission } from "@/lib/constants";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "MAIN_ADMIN" | "STAFF_ADMIN";
  permissions: Permission[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["MAIN_ADMIN", "STAFF_ADMIN"],
      default: "STAFF_ADMIN",
    },
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
