import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isSession } from "@/lib/auth";

/**
 * Which screen a browser gets at `/`: the app, or the sign-in form.
 *
 * This decides what is SHOWN and nothing else. Every route that raises, lists
 * or cancels a charge checks the caller itself (`lib/auth.ts::authorize`), so a
 * browser that reached the app's screen some other way would still be refused
 * by every call that screen makes.
 *
 * It lives here rather than in the page so the two screens are two plain
 * pages, each rendered without reading the request — the page never has to
 * know there is such a thing as being signed out.
 */
export function proxy(request: NextRequest) {
  if (isSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/signin", request.url));
}

export const config = {
  matcher: "/",
};
