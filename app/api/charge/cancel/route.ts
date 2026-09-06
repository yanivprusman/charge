import { NextResponse } from "next/server";
import { daemonJson } from "@/lib/daemon";
import { authorize } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Withdraw one charge, on behalf of the phone.
 *
 * Like the route that raises a charge, this decides nothing: which charges may
 * be cancelled (unpaid ones), what the payer is told, and whether telling him
 * succeeded are all `d cancelCharge`'s, so the phone and the terminal cannot
 * end up with two different ideas of what cancelling means.
 *
 * `notify` defaults to TRUE. Cancelling does not retire the Grow page — the
 * payer holds a link that still works — so silence would leave him able to pay
 * a request that no longer exists. Passing `notify: false` is the caller saying
 * he will tell the payer himself.
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

  const id = String(body.id ?? "").trim();
  if (!id)
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  const notify = body.notify !== false;

  let result: Record<string, unknown>;
  try {
    result = await daemonJson({ command: "cancelCharge", id, noSend: notify ? 0 : 1 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // A cancellation the payer was not told about is a REAL cancellation with a
  // delivery problem — 200, so the phone can show that he still holds a working
  // link instead of implying the charge is still standing.
  return NextResponse.json(result, { status: result.ok === true ? 200 : 400 });
}
