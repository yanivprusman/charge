"use client";

import { useEffect, useRef } from "react";
import type { Charge } from "@/lib/charge-api";
import { Amount } from "./Amount";
import { Spinner } from "./icons";

/**
 * "Are you sure" is the wrong question, so this does not ask it.
 *
 * It names the person, the sum and what it was for, and then says the one thing
 * that is not obvious: cancelling does NOT switch off the payment page. The
 * payer keeps a link that still charges his card, and the WhatsApp message is
 * the only part of this he can see — so the checkbox is on by default, and
 * what turning it off means is written next to it.
 *
 * A native modal <dialog>: Escape, the focus trap and the inert page behind it
 * are the browser's, not re-implemented here.
 */
export function CancelDialog({
  charge,
  notify,
  onNotifyChange,
  busy,
  onDismiss,
  onConfirm,
}: {
  charge: Charge;
  notify: boolean;
  onNotifyChange: (notify: boolean) => void;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const who = charge.payerName || charge.payerPhone;

  return (
    <dialog
      ref={ref}
      data-id="cancel-dialog"
      aria-labelledby="cancel-dialog-title"
      // Escape asks to leave; mid-request there is nothing to leave to, so the
      // dialog stays until the answer is in.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onDismiss();
      }}
      // A click that lands on the dialog element itself is a click on the
      // backdrop — the panel inside covers everything else.
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onDismiss();
      }}
      className="w-[min(26rem,calc(100vw-2rem))] animate-[rise-in_200ms_var(--ease-rise)] rounded-card bg-surface p-0 text-ink shadow-xl"
    >
      <div className="p-5">
        <h2 id="cancel-dialog-title" className="text-lg font-semibold">
          לבטל את הבקשה?
        </h2>
        <p className="mt-3 font-semibold">
          {who} — <Amount value={charge.amountIls} />
        </p>
        {charge.description ? <p className="text-ink-2">{charge.description}</p> : null}

        {charge.sent ? (
          <>
            <p className="mt-3 text-[13px] leading-5 text-ink-2">
              הקישור כבר נשלח אליו והוא ימשיך לעבוד. ההודעה היא מה שמבטל אותו בפועל.
            </p>
            <label
              className={`-mx-2 mt-2 flex items-center gap-2.5 rounded-field px-2 py-2 transition-colors duration-150 ${
                busy ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-2"
              }`}
            >
              <input
                type="checkbox"
                data-id="cancel-notify-payer"
                checked={notify}
                disabled={busy}
                onChange={(e) => onNotifyChange(e.target.checked)}
                className="size-[18px] cursor-[inherit] accent-accent"
              />
              שלח לו הודעה שהבקשה בוטלה
            </label>
          </>
        ) : (
          // Nobody holds the link, so there is nobody to un-tell — and no
          // checkbox, because an option that cannot change the outcome is just
          // something else to read.
          <p className="mt-3 text-[13px] leading-5 text-ink-2">
            הקישור מעולם לא נשלח אליו — אין למי להודיע.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
        {/* "השאר" and not "ביטול": in Hebrew the safe way out of a cancellation
            dialog cannot be the word "cancel". */}
        <button
          type="button"
          data-id="cancel-dialog-keep"
          autoFocus
          disabled={busy}
          onClick={onDismiss}
          className="h-11 cursor-pointer rounded-field border border-line-strong bg-surface px-4 font-medium transition-[background-color,transform] duration-150 hover:bg-surface-3 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          השאר
        </button>
        <button
          type="button"
          data-id="cancel-dialog-confirm"
          disabled={busy}
          onClick={onConfirm}
          className="flex h-11 min-w-36 cursor-pointer items-center justify-center gap-2 rounded-field bg-danger px-4 font-semibold text-accent-ink transition-[filter,transform] duration-150 hover:brightness-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          {busy ? (
            <>
              <Spinner className="size-4" />
              מבטל…
            </>
          ) : (
            "בטל את הבקשה"
          )}
        </button>
      </div>
    </dialog>
  );
}
