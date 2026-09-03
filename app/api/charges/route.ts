import { NextResponse } from "next/server";
import { daemonJson } from "@/lib/daemon";
import { authorize } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What is owed and what came in — straight from the shared `charges` table. */
export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied)
    return NextResponse.json({ ok: false, error: denied }, { status: 401 });

  const status = new URL(request.url).searchParams.get("status") ?? "all";

  try {
    const result = await daemonJson({ command: "charges", status, limit: 100 });
    return NextResponse.json(result, { status: result.ok === true ? 200 : 502 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
