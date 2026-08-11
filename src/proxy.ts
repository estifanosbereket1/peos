import { NextResponse, type NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth gate. Only checks for the session cookie's presence —
 * full session validation happens in server components / server actions
 * via the DAL (see src/lib/session.ts).
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // cookiePrefix must match the auth config (src/lib/auth.ts). Defaults to
  // "better-auth", which would never match our "peos." prefixed cookie.
  const sessionCookie = getSessionCookie(request, { cookiePrefix: "peos" });
  const isPublic = path === "/login" || path === "/signup";

  if (!isPublic && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublic && sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest\\.webmanifest|offline\\.html|.*\\.(?:png|svg|ico|mjs|js|css|woff2?)$).*)"],
};