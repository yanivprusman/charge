import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The one guard on this app.
 *
 * These routes make real payment links and send WhatsApp messages FROM the
 * owner's own number, so an unauthenticated caller is a spam vector wearing his
 * identity — not merely a way to give him money. The service listens on
 * 0.0.0.0, which is the WireGuard overlay AND the home LAN, so "only my devices
 * can reach it" is not true enough to rely on.
 *
 * There is ONE secret, `CHARGE_API_TOKEN`, and two ways of holding it:
 *
 *  - the phone app sends it as a bearer token (baked into the APK);
 *  - a browser signs in once and is handed a session cookie DERIVED from it.
 *
 * The cookie is an HMAC of the token rather than the token, so the secret never
 * sits in a browser, and rotating the token signs every browser out by
 * construction — there is no session table to forget to clear.
 *
 * A missing token in the environment REFUSES every request. An API that guards
 * nothing because its secret was never set is worse than one that is down: the
 * first looks like it is working.
 */
export const SESSION_COOKIE = "charge_session";

/** A year. The phone holds its token forever; a browser that had to sign in
 *  again every week would simply teach its owner to keep the code in a note. */
const SESSION_MAX_AGE_S = 365 * 24 * 60 * 60;

function secret(): string {
  return process.env.CHARGE_API_TOKEN ?? "";
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function mac(message: string): string {
  return createHmac("sha256", secret()).update(message).digest("hex");
}

function sessionValue(): string {
  return mac("charge-web-session-v1");
}

/** Why nothing can be authorised at all, or null when the server is set up. */
export function notConfigured(): string | null {
  return secret() ? null : "CHARGE_API_TOKEN is not set on the server";
}

/** Is this the access code a browser signs in with (the token itself)? */
export function isAccessCode(code: string): boolean {
  return secret() !== "" && same(code, secret());
}

/** Is this the value of a session cookie this server would have issued? */
export function isSession(value: string | undefined): boolean {
  return secret() !== "" && !!value && same(value, sessionValue());
}

/**
 * The signature on a sign-in link (`scripts/make-link.mjs`). It covers the
 * expiry and nothing else: a link is "whoever holds this may sign in until
 * then", so there is no state to keep and nothing to revoke but time.
 */
export function isLinkSignature(exp: number, sig: string): boolean {
  return secret() !== "" && same(sig, mac(`charge-web-link-v1:${exp}`));
}

/**
 * `Secure` only when the browser really is on https. Over plain http — which is
 * how every device on the VPN reaches this app — a `Secure` cookie is silently
 * dropped, and the sign-in would appear to work and then not stick.
 */
export function sessionCookieHeader(request: Request): string {
  const https = request.headers.get("x-forwarded-proto") === "https";
  return (
    `${SESSION_COOKIE}=${sessionValue()}; Path=/; Max-Age=${SESSION_MAX_AGE_S}; ` +
    `HttpOnly; SameSite=Strict${https ? "; Secure" : ""}`
  );
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;
}

function cookieFrom(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * A cookie is sent by the browser whether or not the page asking was ours, so a
 * cookie-authenticated WRITE must also have come from this app's own origin.
 * `SameSite=Strict` already says so; this says it again on the server, because
 * the thing being protected is a WhatsApp message sent in the owner's name and
 * one browser quirk is not enough to stake that on. A bearer token needs no
 * such check — no page can attach one it was not given.
 */
function fromOwnOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Null when the request may proceed; otherwise the reason it may not. */
export function authorize(request: Request): string | null {
  const unset = notConfigured();
  if (unset) return unset;

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer "))
    return same(header.slice(7), secret()) ? null : "bad token";

  const session = cookieFrom(request, SESSION_COOKIE);
  if (!session) return "not signed in: no bearer token and no session";
  if (!isSession(session)) return "bad session";
  if (request.method !== "GET" && !fromOwnOrigin(request))
    return "cross-origin request refused";
  return null;
}
