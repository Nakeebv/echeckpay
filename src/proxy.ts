import { NextResponse, type NextRequest } from "next/server";

// pages reachable without a session (root, auth screens, health)
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot",
  "/reset",
  "/verify",
  "/setup-password",
  "/api/health",
];

/**
 * Gate every page and API behind the session cookie. Middleware only checks
 * presence (edge runtime); the cryptographic HMAC of the token is verified in
 * `src/lib/auth.ts` from every server component and API route as well.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("echeckpay_session")?.value);

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|icon.svg).*)"],
};
