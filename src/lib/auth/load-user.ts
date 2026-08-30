import type { NextRequest } from "next/server";
import type { Permission } from "@/lib/constants";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/models";
import {
  createToken,
  getSession,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth/session";

export function toSessionUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  permissions?: string[];
}): SessionUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as SessionUser["role"],
    permissions: Array.from(user.permissions || []) as Permission[],
  };
}

/** Read live profile from DB so navbar/permissions stay in sync after edits */
export async function getFreshSessionUser(
  request?: NextRequest
): Promise<SessionUser | null> {
  const session = await getSession(request);
  if (!session) return null;

  await connectDB();

  const user = await User.findById(session.id)
    .select("name email role permissions isActive")
    .lean();

  if (!user || !user.isActive) return null;
  return toSessionUser(user);
}

export async function refreshSessionCookie(user: SessionUser): Promise<void> {
  const token = await createToken(user);
  await setSessionCookie(token);
}
