import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/reception", "/housekeeping", "/manager", "/admin", "/guest", "/change-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/guest/:path*",
    "/guest",
    "/reception/:path*",
    "/reception",
    "/housekeeping/:path*",
    "/housekeeping",
    "/manager/:path*",
    "/manager",
    "/admin/:path*",
    "/admin",
    "/change-password",
  ],
};
