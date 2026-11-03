import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth/adminSessionCookie";

function isProtectedAdminPath(pathname: string): boolean {
  return pathname === "/admin" || (pathname.startsWith("/admin/") && pathname !== "/admin/login");
}

/**
 * Lightweight edge-level check: does an admin session cookie exist at all,
 * shaped like a valid token? This is NOT the authoritative check — it can't
 * be, since verifying the HMAC signature needs node:crypto, which isn't
 * available in the Edge Runtime middleware runs in by default. The
 * authoritative check is requireAdmin() in app/admin/page.tsx (verifies
 * signature + expiry). This middleware exists to close the gap the prior
 * no-op left: a request with no session cookie at all previously reached
 * the full page render before being rejected; now it's redirected at the
 * edge instead.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedAdminPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const looksValid = typeof token === "string" && token.includes(".") && token.length > 20;

  if (!looksValid) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
