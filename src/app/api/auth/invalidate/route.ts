import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

/** Clears stale session cookie (Route Handler — cookies allowed here) */
export async function GET(request: NextRequest) {
  await clearSessionCookie();
  const loginUrl = new URL("/login", request.url);
  const redirect = request.nextUrl.searchParams.get("redirect");
  if (redirect?.startsWith("/admin")) {
    loginUrl.searchParams.set("redirect", redirect);
  }
  return NextResponse.redirect(loginUrl);
}
