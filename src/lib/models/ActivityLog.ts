import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  userName: string;
  action: string;
  details?: string;
  relatedId?: string;
  relatedType?: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String },
    relatedId: { type: String },
    relatedType: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ userId: 1 });
ActivityLogSchema.index({ action: 1 });

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
