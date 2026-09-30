/**
 * The browser's whole conversation with this app's API — the same three calls
 * the phone makes (`mobile/.../data/ChargeApi.kt`), authenticated by the
 * session cookie instead of a bearer token.
 *
 * Failures are values, never thrown at the screen: "the server is not
 * reachable" has to render as a sentence, and a charge whose link was made but
 * not delivered has to come back as the charge it is.
 *
 * Every field is optional in practice — the daemon may gain one, and a reply
 * that is missing one must not take the page down — so each shape is read
 * through `?? default` rather than trusted.
 */

export type Charge = {
  id: string;
  payerName: string;
  payerPhone: string;
  amountIls: number;
  description: string;
  payUrl: string;
  /** "pending" | "paid" | "cancelled" */
  status: string;
  sent: boolean;
  paidAmountIls: number;
};

export type ChargesResult = {
  ok: boolean;
  error: string;
  charges: Charge[];
  outstandingIls: number;
};

/** `ok` and `payUrl` are separate facts on purpose: a link that was created but
 *  not delivered is a real charge with a delivery problem. */
export type ChargeResult = {
  ok: boolean;
  error: string;
  payUrl: string;
  payerName: string;
  amountIls: number;
  sent: boolean;
  sendError: string;
};

/** `notified` is its own fact rather than folded into `ok`: cancelling always
 *  stops the charge counting as owed, but the Grow page stays payable, so
 *  whether the payer was TOLD decides whether he might still pay. */
export type CancelResult = {
  ok: boolean;
  error: string;
  notified: boolean;
  sendError: string;
  message: string;
};

export const isPaid = (c: Charge) => c.status === "paid";
export const isCancelled = (c: Charge) => c.status === "cancelled";
/** A paid charge is refunded rather than cancelled, and a cancelled one has
 *  nowhere left to go. */
export const canCancel = (c: Charge) => !isPaid(c) && !isCancelled(c);
/** Paid, but not the amount that was asked for — the daemon records both. */
export const paidWrongAmount = (c: Charge) =>
  isPaid(c) && Math.abs(c.paidAmountIls - c.amountIls) > 0.5;

type Reply = { code: number; body: Record<string, unknown> | null };

async function call(path: string, init?: RequestInit): Promise<Reply> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: "no-store" });
  } catch {
    return { code: 0, body: null };
  }
  try {
    const body = await response.json();
    return { code: response.status, body: body && typeof body === "object" ? body : null };
  } catch {
    return { code: response.status, body: null };
  }
}

function post(path: string, payload: unknown): Promise<Reply> {
  return call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** The session this page was rendered with is gone (the token was rotated, or
 *  the browser was signed out in another tab). The server decides what to show
 *  a signed-out browser, so ask it again rather than imitate it here. */
function signedOut(r: Reply): boolean {
  if (r.code !== 401) return false;
  window.location.reload();
  return true;
}

/** What to show when the reply was not the JSON we expected — a status code on
 *  its own is useless to the person reading it. */
function describe(r: Reply): string {
  if (r.code === 0) return "אין חיבור לשרת";
  if (r.code === 401) return "הכניסה פגה — טוען מחדש";
  return `השרת החזיר תשובה לא צפויה (${r.code})`;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function toCharge(raw: unknown): Charge {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(c.id),
    payerName: str(c.payerName),
    payerPhone: str(c.payerPhone),
    amountIls: num(c.amountIls),
    description: str(c.description),
    payUrl: str(c.payUrl),
    status: str(c.status) || "pending",
    sent: c.sent === true,
    paidAmountIls: num(c.paidAmountIls),
  };
}

export async function listCharges(): Promise<ChargesResult> {
  const r = await call("/api/charges?status=all");
  const b = r.body;
  if (signedOut(r) || !b || typeof b.ok !== "boolean")
    return { ok: false, error: describe(r), charges: [], outstandingIls: 0 };
  return {
    ok: b.ok,
    error: str(b.error),
    charges: Array.isArray(b.charges) ? b.charges.map(toCharge) : [],
    outstandingIls: num(b.outstandingIls),
  };
}

export async function raiseCharge(fields: {
  name: string;
  phone: string;
  amount: string;
  description: string;
}): Promise<ChargeResult> {
  const r = await post("/api/charge", {
    to: fields.phone,
    name: fields.name,
    amount: fields.amount,
    description: fields.description,
  });
  const b = r.body;
  const blank = { payUrl: "", payerName: "", amountIls: 0, sent: false, sendError: "" };
  if (signedOut(r) || !b) return { ok: false, error: describe(r), ...blank };
  return {
    ok: b.ok === true,
    error: str(b.error),
    payUrl: str(b.payUrl),
    payerName: str(b.payerName),
    amountIls: num(b.amountIls),
    sent: b.sent === true,
    sendError: str(b.sendError),
  };
}

/**
 * Withdraw a charge.
 *
 * @param notify tell the payer, on WhatsApp, that the request is off. Cancelling
 *   cannot take the Grow page down, so an untold payer is holding a link that
 *   still charges his card.
 */
export async function cancelCharge(id: string, notify: boolean): Promise<CancelResult> {
  const r = await post("/api/charge/cancel", { id, notify });
  const b = r.body;
  if (signedOut(r) || !b)
    return { ok: false, error: describe(r), notified: false, sendError: "", message: "" };
  return {
    ok: b.ok === true,
    error: str(b.error),
    notified: b.notified === true,
    sendError: str(b.sendError),
    message: str(b.message),
  };
}

/** "wrong_code" is the one refusal with its own wording; anything else is the
 *  server explaining itself and is shown as it said it. */
export async function signIn(code: string): Promise<{ ok: boolean; error: string }> {
  const r = await post("/api/session", { code });
  if (r.body?.ok === true) return { ok: true, error: "" };
  if (r.body?.error === "wrong_code") return { ok: false, error: "הקוד שגוי" };
  return { ok: false, error: str(r.body?.error) || describe(r) };
}

export async function signOut(): Promise<void> {
  await call("/api/session", { method: "DELETE" });
}
