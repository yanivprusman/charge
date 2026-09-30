"use client";

import { useState } from "react";
import { AlertIcon, CheckIcon, CloseIcon, CopyIcon } from "./icons";

/**
 * @param extra text worth carrying out of the notice by hand — a payment link
 *   that was created but not delivered, or a cancellation the payer was not
 *   told about. Copying it into a chat IS the recovery in both cases.
 */
export type NoticeContent = {
  tone: "ok" | "error";
  text: React.ReactNode;
  extra?: string;
};

/**
 * @param onDismiss absent for a notice that is a STATE rather than an event —
 *   a connection problem is not news to be acknowledged, and the next
 *   successful load removes it.
 */
export function Notice({
  notice,
  onDismiss,
  dataId,
}: {
  notice: NoticeContent;
  onDismiss?: () => void;
  dataId: string;
}) {
  const ok = notice.tone === "ok";
  return (
    <div
      role={ok ? "status" : "alert"}
      data-id={dataId}
      className={`flex animate-[rise-in_380ms_var(--ease-rise)] items-start gap-2.5 rounded-lg border p-3.5 ${
        ok ? "border-ok/25 bg-ok-soft" : "border-danger/25 bg-danger-soft"
      }`}
    >
      {ok ? (
        <CheckIcon className="mt-0.5 shrink-0 text-ok" />
      ) : (
        <AlertIcon className="mt-0.5 shrink-0 text-danger" />
      )}
      <div className="min-w-0 flex-1">
        <p>{notice.text}</p>
        {notice.extra ? <Extra text={notice.extra} /> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          data-id={`${dataId}-dismiss`}
          aria-label="סגור"
          onClick={onDismiss}
          className="-m-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-field text-ink-2 transition-[background-color,transform] duration-150 hover:bg-ink/10 active:scale-95"
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}

function Extra({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  // The clipboard API exists only on https and localhost. Over plain http on
  // the VPN there is no button — the text below selects whole on one click,
  // which is the same recovery by hand. A button that cannot copy is worse
  // than no button.
  const canCopy = typeof navigator !== "undefined" && !!navigator.clipboard;

  return (
    <div className="mt-2">
      <p
        dir="auto"
        data-id="notice-extra"
        className="whitespace-pre-wrap text-[13px] font-medium [overflow-wrap:anywhere] select-all"
      >
        {text}
      </p>
      {canCopy ? (
        <button
          type="button"
          data-id="notice-copy"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="mt-2 flex h-8 cursor-pointer items-center gap-1.5 rounded-field border border-ink/15 bg-surface px-2.5 text-[13px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-surface-2 active:scale-95"
        >
          <CopyIcon className="size-4" />
          {copied ? "הועתק" : "העתק"}
        </button>
      ) : null}
    </div>
  );
}
