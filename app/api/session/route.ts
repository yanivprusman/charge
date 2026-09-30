import { NextResponse } from "next/server";
import {
  clearSessionCookieHeader,
  isAccessCode,
  notConfigured,
  sessionCookieHeader,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign a browser in.
 *
 * The access code IS `CHARGE_API_TOKEN` — the same secret the phone app
 * carries. A second, friendlier password would be a second thing that can open
 * this API, and a weaker one: it would exist only to be typed.
 */
export async function POST(request: Request) {
  const unset = notConfigured();
  if (unset) return NextResponse.json({ ok: false, error: unset }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!isAccessCode(String(body.code ?? "").trim()))
    return NextResponse.json({ ok: false, error: "wrong_code" }, { status: 401 });

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionCookieHeader(request) } },
  );
}

/** Sign this browser out. Needs no proof of anything: it only ever removes
 *  access, and only from the browser that asked. */
export async function DELETE() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader() } },
  );
}
