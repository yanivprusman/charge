"use client";

import { Spinner } from "./icons";

export type ChargeFields = { name: string; phone: string; amount: string; what: string };

/** Words in a name, by the same rule the daemon applies before Grow sees it:
 *  Grow fails the whole payment page on a one-word customerName, in any
 *  language. Counted here only to WARN — the daemon stays the authority, and
 *  its refusal is still what gets shown if one slips through. */
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  warning = false,
  figure = false,
  inputMode,
  type = "text",
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  warning?: boolean;
  /** Digits: the figure face, left-to-right, still hugging the label's side. */
  figure?: boolean;
  inputMode?: "text" | "tel" | "decimal";
  type?: "text" | "tel";
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        data-id={id}
        type={type}
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={warning || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`mt-1 h-11 w-full rounded-field border bg-surface px-3 text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:ring-3 ${
          warning
            ? "border-danger focus:ring-danger/15"
            : "border-line-strong hover:border-ink-3 focus:border-accent focus:ring-accent-soft"
        } ${figure ? "figure text-end" : ""}`}
      />
      {hint ? (
        <p id={`${id}-hint`} className={`mt-1 text-xs leading-5 ${warning ? "text-danger" : "text-ink-3"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Four facts and one button.
 *
 * The form does NOT re-implement the rules. Whether a number is a real mobile,
 * whether the amount is positive, whether Grow will accept the name — all of
 * that is the daemon's, and its refusal is shown verbatim. The one thing
 * checked here is that a field isn't empty, which is not a rule so much as a
 * reason not to spend a round trip.
 */
export function ChargeForm({
  fields,
  onChange,
  busy,
  onSubmit,
  nameRef,
}: {
  fields: ChargeFields;
  onChange: (fields: ChargeFields) => void;
  busy: boolean;
  onSubmit: () => void;
  nameRef: React.Ref<HTMLInputElement>;
}) {
  const { name, phone, amount, what } = fields;
  const set = (key: keyof ChargeFields) => (value: string) => onChange({ ...fields, [key]: value });

  // The rule is Grow's, not ours, and it fails the whole payment page — so it
  // is said before the field is filled, and said louder the moment a name
  // arrives that will not pass.
  const nameTooShort = name.trim() !== "" && wordCount(name) < 2;
  const ready = [name, phone, amount, what].every((v) => v.trim() !== "");

  return (
    <form
      data-id="charge-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onSubmit();
      }}
      className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5"
    >
      <Field
        id="payer-name"
        label="שם מלא"
        value={name}
        onChange={set("name")}
        inputRef={nameRef}
        warning={nameTooShort}
        hint={
          nameTooShort
            ? `"${name.trim()}" הוא שם אחד — חברת הסליקה תדחה את זה. הוסף שם משפחה.`
            : "שם ושם משפחה — חברת הסליקה דורשת שניהם"
        }
      />
      <Field
        id="payer-phone"
        label="טלפון"
        value={phone}
        onChange={set("phone")}
        type="tel"
        inputMode="tel"
        figure
        hint="לשם יישלח הקישור בוואטסאפ"
      />
      <Field
        id="charge-amount"
        label="סכום בשקלים"
        value={amount}
        onChange={set("amount")}
        inputMode="decimal"
        figure
      />
      <Field
        id="charge-description"
        label="עבור מה"
        value={what}
        onChange={set("what")}
        hint="מופיע בדף התשלום ובחיוב בכרטיס"
      />

      <button
        type="submit"
        data-id="request-payment"
        disabled={!ready || busy}
        className="mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 font-semibold text-accent-ink transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent disabled:active:scale-100"
      >
        {busy ? (
          <>
            <Spinner />
            מייצר קישור…
          </>
        ) : amount.trim() ? (
          `בקש ${amount.trim()} ₪ בוואטסאפ`
        ) : (
          "בקש תשלום בוואטסאפ"
        )}
      </button>
    </form>
  );
}
