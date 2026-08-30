import { connectDB } from "@/lib/db/connect";
import { ActivityLog } from "@/lib/models";
import type { SessionUser } from "@/lib/auth/session";
import mongoose from "mongoose";

export async function logActivity(
  user: SessionUser,
  action: string,
  details?: string,
  relatedId?: string,
  relatedType?: string
): Promise<void> {
  await connectDB();
  await ActivityLog.create({
    userId: new mongoose.Types.ObjectId(user.id),
    userName: user.name,
    action,
    details,
    relatedId,
    relatedType,
  });
}
