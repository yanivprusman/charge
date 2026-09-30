import { isLinkSignature, sessionCookieHeader } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign a browser in from a link made by `scripts/make-link.mjs`.
 *
 * The success reply is a page that navigates, not a redirect. The session
 * cookie is `SameSite=Strict`, and a browser withholds a Strict cookie from a
 * redirect chain that began on another site — so a link opened from a chat
 * would set the cookie and then land on the sign-in form anyway. A navigation
 * the app's own page starts is same-site, and carries it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const exp = Number(params.get("exp"));
  const sig = params.get("sig") ?? "";

  const live = Number.isInteger(exp) && exp * 1000 > Date.now();
  if (!live || !isLinkSignature(exp, sig))
    return new Response(null, { status: 303, headers: { Location: "/signin/expired" } });

  return new Response(
    '<!doctype html><meta charset="utf-8"><title>גבייה</title>' +
      '<script>location.replace("/")</script>',
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": sessionCookieHeader(request),
      },
    },
  );
}
