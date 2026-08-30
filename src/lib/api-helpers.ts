import { NextRequest, NextResponse } from "next/server";
import { getFreshSessionUser } from "@/lib/auth/load-user";
import { hasPermission, type SessionUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/constants";
import { getErrorMessage } from "@/lib/utils";

export async function requireAuth(
  permission?: Permission,
  request?: NextRequest
): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getFreshSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (permission && !hasPermission(user, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user };
}

export function apiError(error: unknown, status = 500) {
  const message = getErrorMessage(error);
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
