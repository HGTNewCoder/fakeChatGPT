import { NextResponse, type NextRequest } from "next/server";

// Must match the cookie name in lib/auth.ts. Proxy runs apart from the app, so it doesn't import it.
const SESSION_COOKIE = "session";

/**
 * Share links (/g/<id>) sent to someone who isn't signed in go to the login page with a `next`
 * parameter, so they land on the shared GPT after logging in. The session itself is still verified
 * by the (chat) layout; this only checks that a cookie exists.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: "/g/:path*",
};
