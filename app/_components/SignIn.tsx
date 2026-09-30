"use client";

import { useState } from "react";
import { signIn } from "@/lib/charge-api";
import { Spinner } from "./icons";

/**
 * What a browser that has not signed in sees instead of the app.
 *
 * It says why the door is locked and exactly where the key is, because the only
 * person who will ever read it is the owner on a new browser — and "access
 * code" with no further word sends him looking for a password he never chose.
 */
export default function SignIn({ linkExpired }: { linkExpired: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    linkExpired ? "קישור הכניסה פג תוקף. צור קישור חדש, או הזן את הקוד." : "",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const r = await signIn(code.trim());
    if (r.ok) {
      // A full navigation, so the server renders the app for a browser that now
      // carries the session — the page's own idea of "signed in" is never
      // consulted.
      window.location.replace("/");
      return;
    }
    setError(r.error);
    setBusy(false);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <form
        data-id="sign-in-form"
        onSubmit={submit}
        className="w-full max-w-[22.5rem] rounded-card border border-line bg-surface p-6"
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 1 KB SVG the
              browser already holds as the tab icon; next/image has nothing to add */}
          <img src="/icon.svg" alt="" width={36} height={36} className="size-9" />
          <h1 className="text-xl font-semibold">גבייה</h1>
        </div>
        <p className="mt-4 text-ink-2">
          מכאן נשלחות בקשות תשלום מהוואטסאפ שלך, ולכן הדף נעול.
        </p>

        <label htmlFor="access-code" className="mt-5 block text-[13px] font-medium text-ink-2">
          קוד גישה
        </label>
        <input
          id="access-code"
          data-id="access-code"
          type="password"
          autoComplete="current-password"
          autoFocus
          dir="ltr"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby="access-code-hint"
          className={`mt-1 h-11 w-full rounded-field border bg-surface px-3 font-mono text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:ring-3 ${
            error
              ? "border-danger focus:ring-danger/15"
              : "border-line-strong hover:border-ink-3 focus:border-accent focus:ring-accent-soft"
          }`}
        />
        {error ? (
          <p id="access-code-hint" role="alert" className="mt-1 text-xs leading-5 text-danger">
            {error}
          </p>
        ) : (
          <p id="access-code-hint" className="mt-1 text-xs leading-5 text-ink-3">
            הערך של <bdi className="font-mono">CHARGE_API_TOKEN</bdi> בקובץ{" "}
            <bdi className="font-mono">.env.local</bdi> של האפליקציה.
          </p>
        )}

        <button
          type="submit"
          data-id="sign-in"
          disabled={!code.trim() || busy}
          className="mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 font-semibold text-accent-ink transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent disabled:active:scale-100"
        >
          {busy ? (
            <>
              <Spinner />
              נכנס…
            </>
          ) : (
            "כניסה"
          )}
        </button>
      </form>
    </main>
  );
}
