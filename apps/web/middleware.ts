import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast, edge-safe route gate. This checks only for the *presence* of the
 * Auth.js session cookie — it cannot verify the session (that needs
 * Prisma, which is Node-only, and this middleware runs on the Edge
 * runtime) so it only short-circuits the obvious case (no cookie at all)
 * and redirects to sign-in. The authoritative checks — is the session
 * actually valid, is the role ORGANIZER/SUPERADMIN for /admin routes —
 * happen server-side in each route group's layout.tsx (via `auth()`) and
 * again in every tRPC procedure via protectedProcedure/organizerProcedure.
 * This file is defense-in-depth for UX redirects only, never the security
 * boundary.
 */
const PUBLIC_PATHS = [
  "/",
  "/faq",
  "/privacy",
  "/terms",
  "/conduct",
  "/signin",
  "/verify",
  "/manifest.webmanifest",
];

const SESSION_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname.startsWith("/sw.js")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
