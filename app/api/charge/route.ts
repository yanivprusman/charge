import { NextResponse } from "next/server";
import { daemonJson } from "@/lib/daemon";
import { authorize } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Raise one charge, on behalf of the phone.
 *
 * This route decides nothing about money. It checks who is asking, hands the
 * four facts to `d charge`, and returns the daemon's own answer — so the phone,
 * the terminal and any future client are all looking at one implementation of
 * what a charge is. Validation (a real mobile, a positive amount, a two-word
 * payer name that Grow will accept) lives there too, because a rule enforced in
 * two places is a rule that will disagree with itself.
 */
export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied)
    return NextResponse.json({ ok: false, error: denied }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const to = String(body.to ?? "").trim();
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const amount = String(body.amount ?? "").trim();

  let result: Record<string, unknown>;
  try {
    result = await daemonJson({
      command: "charge",
      to,
      name,
      for: description,
      amount,
      // The phone always sends. "Make the link but don't send it" is a
      // terminal affordance for when the bridge is down; on a phone the WhatsApp
      // app is right there, and a link nobody sent is just a to-do.
      noSend: 0,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // A charge whose link was created but not delivered is a REAL charge with a
  // problem, not a failure: 200 with sent:false, so the phone can show the link
  // and let him send it by hand instead of losing it behind an error screen.
  const created = result.ok === true || typeof result.payUrl === "string";
  return NextResponse.json(result, { status: created ? 200 : 400 });
}
