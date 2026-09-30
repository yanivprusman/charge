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
 * The decision lives here rather than in the page for a measured reason
 * (2026-09-30, Next 16.3.4 webpack dev, Chrome 144). A page component that
 * awaits `cookies()` renders late, so its script is left out of the HTML and
 * fetched by the client at hydration — and that fetch was cancelled by the
 * browser on 7 of 8 cold loads, leaving "This page couldn't load". A page that
 * renders without awaiting anything ships its script in the HTML, and failed 0
 * of 8. Keeping both pages synchronous is what makes the first visit reliable;
 * this file is what lets them be.
 */
export function proxy(request: NextRequest) {
  if (isSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/signin", request.url));
}

export const config = {
  matcher: "/",
};
