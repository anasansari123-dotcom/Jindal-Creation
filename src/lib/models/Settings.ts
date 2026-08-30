import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISettings extends Document {
  key: string;
  value: unknown;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const Settings: Model<ISettings> =
  mongoose.models.Settings ||
  mongoose.model<ISettings>("Settings", SettingsSchema);

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const { connectDB } = await import("@/lib/db/connect");
  await connectDB();
  const setting = await Settings.findOne({ key });
  return setting ? (setting.value as T) : defaultValue;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const { connectDB } = await import("@/lib/db/connect");
  await connectDB();
  await Settings.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true }
  );
}
