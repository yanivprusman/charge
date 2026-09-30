import {
  type Charge,
  canCancel,
  isCancelled,
  isPaid,
  paidWrongAmount,
} from "@/lib/charge-api";
import { Amount } from "./Amount";

/**
 * The status is carried by the dot — its colour AND its shape, so it survives
 * a colour-blind reader and a washed-out screen — and the words beside it stay
 * in ordinary ink. A whole line tinted amber is a line that is hard to read.
 *
 * A pending charge is a ring because nothing has filled it yet.
 */
function StatusDot({ charge }: { charge: Charge }) {
  const look = paidWrongAmount(charge)
    ? "bg-warn"
    : isPaid(charge)
      ? "bg-ok"
      : isCancelled(charge)
        ? "bg-line-strong"
        : "border-2 border-warn";
  return <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${look}`} />;
}

function StatusLabel({ charge }: { charge: Charge }) {
  if (paidWrongAmount(charge))
    return (
      <>
        שולם <Amount value={charge.paidAmountIls} /> — לא הסכום שנדרש
      </>
    );
  if (isPaid(charge)) return <>שולם</>;
  if (isCancelled(charge)) return <>בוטלה</>;
  return <>{charge.sent ? "נשלח, ממתין לתשלום" : "הקישור לא נשלח"}</>;
}

function ChargeRow({ charge, onCancel }: { charge: Charge; onCancel: () => void }) {
  const cancelled = isCancelled(charge);
  return (
    <li data-id="charge-row" data-status={charge.status} className="flex items-center gap-3 px-4 py-3">
      <StatusDot charge={charge} />
      <div className="min-w-0 flex-1">
        {charge.payerName ? (
          <p className="truncate font-semibold">{charge.payerName}</p>
        ) : (
          <p className="figure truncate text-end font-semibold">{charge.payerPhone}</p>
        )}
        <p className="truncate text-[13px] leading-5 text-ink-2">{charge.description}</p>
        <p className="text-xs leading-5 text-ink-3">
          <StatusLabel charge={charge} />
        </p>
      </div>
      {/* Struck through rather than dimmed: a cancelled charge is not a quieter
          debt, it is not a debt, and the total above has stopped counting it. */}
      <Amount
        value={charge.amountIls}
        className={`text-base font-semibold ${cancelled ? "text-ink-3 line-through" : ""}`}
        signClassName="font-medium text-ink-3"
      />
      {/* The slot is there on every row, so the sums stay in one column whether
          or not a row can still be cancelled. Low emphasis on purpose —
          withdrawing a request is rare next to raising one. */}
      <div className="flex w-14 shrink-0 justify-end">
        {canCancel(charge) ? (
          <button
            type="button"
            data-id="cancel-charge"
            onClick={onCancel}
            className="h-11 cursor-pointer rounded-field px-3 text-[13px] font-medium text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            בטל
          </button>
        ) : null}
      </div>
    </li>
  );
}

const rowFrame = "overflow-hidden rounded-card border border-line bg-surface";

export function ChargeList({
  charges,
  onCancel,
}: {
  charges: Charge[];
  onCancel: (charge: Charge) => void;
}) {
  return (
    <ul data-id="charge-list" className={`divide-y divide-line ${rowFrame}`}>
      {charges.map((c) => (
        <ChargeRow key={c.id} charge={c} onCancel={() => onCancel(c)} />
      ))}
    </ul>
  );
}

/** What the list looks like before the first answer: rows of the same height
 *  as real ones, so nothing jumps when they arrive. */
export function ChargeListSkeleton() {
  return (
    <ul aria-hidden="true" className={`divide-y divide-line ${rowFrame}`}>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="skeleton size-2.5 rounded-full" />
          <div className="flex-1 space-y-2 py-1.5">
            <div className="skeleton h-3.5 w-32 rounded-field" />
            <div className="skeleton h-3 w-44 rounded-field" />
            <div className="skeleton h-3 w-24 rounded-field" />
          </div>
          <div className="skeleton h-4 w-16 rounded-field" />
          <div className="w-14" />
        </li>
      ))}
    </ul>
  );
}
