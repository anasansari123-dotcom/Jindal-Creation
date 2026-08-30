import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { Permission } from "@/lib/constants";
import { COOKIE_NAME } from "@/lib/auth/cookie-name";
import { getJwtSecret } from "@/lib/auth/jwt-secret";

const JWT_SECRET = getJwtSecret();

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "MAIN_ADMIN" | "STAFF_ADMIN";
  permissions: Permission[];
}

export interface JWTPayload extends SessionUser {
  iat?: number;
  exp?: number;
}

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

function readTokenFromCookieHeader(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export async function getSession(request?: NextRequest): Promise<SessionUser | null> {
  let token = request?.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }

  if (!token) {
    const cookieHeader = request?.headers.get("cookie") ?? (await headers()).get("cookie");
    token = readTokenFromCookieHeader(cookieHeader);
  }

  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    permissions: payload.permissions || [],
  };
}

export function hasPermission(
  user: SessionUser | null,
  permission: Permission
): boolean {
  if (!user) return false;
  if (user.role === "MAIN_ADMIN") return true;
  return user.permissions.includes(permission);
}

export { COOKIE_NAME };
