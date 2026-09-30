"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Charge,
  cancelCharge,
  listCharges,
  raiseCharge,
  signOut,
} from "@/lib/charge-api";
import { Amount } from "./Amount";
import { CancelDialog } from "./CancelDialog";
import { ChargeForm, type ChargeFields } from "./ChargeForm";
import { ChargeList, ChargeListSkeleton } from "./ChargeList";
import { Notice, type NoticeContent } from "./Notice";
import { RefreshIcon, SignOutIcon } from "./icons";

/**
 * גבייה in a browser — the same one screen as the phone app
 * (`mobile/shared/.../App.kt`), because there is still only one thing to do:
 * four fields, one button, and the running list of who still owes what.
 *
 * What a wide window adds is room, not features: the form and the list sit
 * side by side, so raising a charge never scrolls the history out of view.
 */

const EMPTY: ChargeFields = { name: "", phone: "", amount: "", what: "" };

/** A tab is left open for hours where the phone app is opened fresh each time,
 *  so coming back to it re-reads the list — but not on every flick of focus. */
const STALE_AFTER_MS = 15_000;

/** Long enough to see the refresh icon turn. A reload that answers in 40 ms
 *  otherwise looks exactly like a button that did nothing. */
const REFRESH_MIN_MS = 500;

const headerButton =
  "flex h-10 cursor-pointer items-center gap-1.5 rounded-field px-2.5 text-[13px] font-medium text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-surface-3 hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

/** Why no WhatsApp went out — said plainly, because "cancelled" on its own
 *  leaves open whether the payer knows, and that is the difference between a
 *  live payment link and a dead one. */
function whyNobodyWasTold(c: Charge, notify: boolean): string {
  if (!c.sent) return "הקישור מעולם לא נשלח אליו";
  if (!notify) return "לא נשלחה הודעה, והקישור שבידיו עדיין עובד";
  return "לא נשלחה הודעה";
}

export default function ChargeScreen() {
  const [fields, setFields] = useState<ChargeFields>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeContent | null>(null);

  // Three different things, kept apart: whether the first answer has arrived
  // at all, whether any answer was ever a good one, and what is wrong NOW.
  // Folding them into one flag is how a page ends up announcing "nobody owes
  // you anything" while it is merely offline.
  const [answered, setAnswered] = useState(false);
  const [charges, setCharges] = useState<Charge[] | null>(null);
  const [outstanding, setOutstanding] = useState(0);
  // A connection problem is a STATE, not an event: it disappears by itself the
  // moment a load succeeds, so it never sits beside the one-off notices.
  const [listError, setListError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // The charge being cancelled is held rather than a boolean, so the dialog
  // can name the person and the sum instead of asking "are you sure?" about
  // nothing in particular.
  const [cancelTarget, setCancelTarget] = useState<Charge | null>(null);
  const [notifyPayer, setNotifyPayer] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    const r = await listCharges();
    if (r.ok) {
      setCharges(r.charges);
      setOutstanding(r.outstandingIls);
      setListError("");
    } else {
      setListError(r.error || "לא הצלחנו לטעון את הרשימה");
    }
    setAnswered(true);
  }, []);

  useEffect(() => {
    // Every setState in load() is behind its await — this reads the list, it
    // does not derive state during render. The rule cannot see past the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > STALE_AFTER_MS)
        void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([load(), new Promise((done) => setTimeout(done, REFRESH_MIN_MS))]);
    setRefreshing(false);
  }

  async function submit() {
    setBusy(true);
    setNotice(null);
    const r = await raiseCharge({
      name: fields.name.trim(),
      phone: fields.phone.trim(),
      amount: fields.amount.trim(),
      description: fields.what.trim(),
    });
    if (r.ok && r.sent) {
      setFields(EMPTY);
      setNotice({
        tone: "ok",
        text: (
          <>
            נשלח ל{r.payerName} — <Amount value={r.amountIls} />
          </>
        ),
      });
      nameRef.current?.focus();
    } else if (r.payUrl) {
      // The link exists; only delivery failed. Hand it over rather than hiding
      // it behind an error.
      setNotice({
        tone: "error",
        text: `הקישור נוצר אבל לא נשלח: ${r.sendError || "שגיאת שליחה"}`,
        extra: r.payUrl,
      });
    } else {
      setNotice({ tone: "error", text: r.error || "לא הצלחנו ליצור בקשת תשלום" });
    }
    setBusy(false);
    void load();
  }

  async function confirmCancel(target: Charge) {
    setCancelling(true);
    setNotice(null);
    const r = await cancelCharge(target.id, notifyPayer);
    const who = target.payerName || target.payerPhone;
    if (r.ok && r.notified) {
      setNotice({ tone: "ok", text: `הבקשה בוטלה ו${who} עודכן בוואטסאפ` });
    } else if (r.ok) {
      // Cancelled, and nobody needed telling: either the link never went out,
      // or he said he would tell him himself.
      setNotice({ tone: "ok", text: `הבקשה בוטלה — ${whyNobodyWasTold(target, notifyPayer)}` });
    } else if (r.sendError) {
      // The withdrawal stands; only the message failed. That is the half the
      // payer can see, so it is handed over to send by hand rather than
      // reported as a failed cancellation.
      setNotice({
        tone: "error",
        text: `הבקשה בוטלה, אבל ההודעה ל${who} לא נשלחה — הוא עדיין מחזיק קישור פעיל`,
        extra: r.message,
      });
    } else {
      setNotice({ tone: "error", text: r.error || "לא הצלחנו לבטל את הבקשה" });
    }
    setCancelling(false);
    setCancelTarget(null);
    void load();
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] px-5 pb-28 pt-4 sm:px-8 sm:pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 1 KB SVG the
              browser already holds as the tab icon; next/image has nothing to add */}
          <img src="/icon.svg" alt="" width={32} height={32} className="size-8" />
          <h1 className="text-lg font-semibold">גבייה</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-id="refresh-charges"
            aria-label="רענן"
            title="רענן"
            disabled={refreshing}
            onClick={refresh}
            className={headerButton}
          >
            <RefreshIcon className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            data-id="sign-out"
            onClick={async () => {
              await signOut();
              window.location.replace("/");
            }}
            className={headerButton}
          >
            <SignOutIcon />
            יציאה
          </button>
        </div>
      </header>

      <main className="mt-6 grid gap-x-10 gap-y-5 min-[860px]:mt-10 min-[860px]:grid-cols-[minmax(0,380px)_minmax(0,1fr)] min-[860px]:grid-rows-[auto_1fr]">
        <Summary answered={answered} known={charges !== null} outstanding={outstanding} />

        <div className="flex flex-col gap-3 self-start min-[860px]:sticky min-[860px]:top-6 min-[860px]:col-start-1 min-[860px]:row-span-2 min-[860px]:row-start-1">
          {notice ? (
            <Notice notice={notice} dataId="result-notice" onDismiss={() => setNotice(null)} />
          ) : null}
          {listError ? (
            <Notice notice={{ tone: "error", text: listError }} dataId="connection-notice" />
          ) : null}
          <ChargeForm
            fields={fields}
            onChange={setFields}
            busy={busy}
            onSubmit={submit}
            nameRef={nameRef}
          />
        </div>

        <section
          aria-labelledby="history-title"
          className="min-[860px]:col-start-2 min-[860px]:row-start-2"
        >
          {!answered ? (
            <>
              <HistoryTitle />
              <ChargeListSkeleton />
            </>
          ) : charges === null ? null : charges.length > 0 ? (
            <>
              <HistoryTitle />
              <ChargeList
                charges={charges}
                onCancel={(c) => {
                  setNotifyPayer(c.sent);
                  setCancelTarget(c);
                }}
              />
            </>
          ) : (
            <p className="rounded-card border border-dashed border-line-strong px-5 py-10 text-center text-ink-2">
              עוד לא ביקשת תשלום מאף אחד.
            </p>
          )}
        </section>
      </main>

      {cancelTarget ? (
        <CancelDialog
          charge={cancelTarget}
          notify={notifyPayer}
          onNotifyChange={setNotifyPayer}
          busy={cancelling}
          onDismiss={() => setCancelTarget(null)}
          onConfirm={() => confirmCancel(cancelTarget)}
        />
      ) : null}
    </div>
  );
}

function HistoryTitle() {
  return (
    <h2 id="history-title" className="mb-2 text-[13px] font-medium text-ink-2">
      היסטוריה
    </h2>
  );
}

/**
 * The number this page exists to show, at the size of a headline.
 *
 * Until an answer has arrived it is a placeholder, and when no answer has EVER
 * been good it says so: "nobody owes you anything" is a claim about money and
 * is only made when the list was actually read.
 */
function Summary({
  answered,
  known,
  outstanding,
}: {
  answered: boolean;
  known: boolean;
  outstanding: number;
}) {
  const frame = "min-[860px]:col-start-2 min-[860px]:row-start-1";
  const headline = "text-[1.75rem] font-semibold leading-[1.2]";

  if (!answered)
    return (
      <div aria-hidden="true" className={frame}>
        <div className="skeleton h-4 w-20 rounded-field" />
        <div className="skeleton mt-3 h-12 w-48 rounded-field" />
      </div>
    );

  if (!known)
    return (
      <div className={frame}>
        <p className={`${headline} text-ink-2`}>הרשימה לא נטענה</p>
      </div>
    );

  if (outstanding <= 0)
    return (
      <div className={frame}>
        <p data-id="outstanding-total" className={headline}>
          אין חובות פתוחים
        </p>
      </div>
    );

  return (
    <div className={frame}>
      <p className="text-[13px] font-medium text-ink-2">חייבים לך</p>
      <p data-id="outstanding-total" className="leading-[1.15]">
        <Amount
          value={outstanding}
          className="text-[clamp(2.75rem,9vw,3.75rem)] font-medium"
          signClassName="text-[0.5em] font-medium text-ink-3"
        />
      </p>
    </div>
  );
}
