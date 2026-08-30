import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/cookie-name";
import { getJwtSecret } from "@/lib/auth/jwt-secret";

const JWT_SECRET = getJwtSecret();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/api")) {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  if (pathname === "/login") {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      try {
        await jwtVerify(token, JWT_SECRET);
        // Valid JWT alone is not enough — layout verifies user in DB.
        // Auto-redirect here caused loops when the cookie outlived the DB user (e.g. after seed).
      } catch {
        const response = NextResponse.next();
        response.cookies.delete(COOKIE_NAME);
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
