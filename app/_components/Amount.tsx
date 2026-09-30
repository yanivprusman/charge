const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 1200 → "1,200", 12.5 → "12.5". Whole shekels carry no ".00": nobody rents
 *  out a car for 350.00. */
export function money(v: number): string {
  return formatter.format(v);
}

/**
 * A sum of money: the digits in the figure face, then the shekel sign.
 *
 * The number is its own isolated left-to-right run, so the Hebrew sentence
 * around it cannot reorder the digits or pull the sign to the wrong side — it
 * always reads number-then-₪, the way it is written by hand.
 */
export function Amount({
  value,
  className,
  signClassName,
}: {
  value: number;
  className?: string;
  signClassName?: string;
}) {
  return (
    <span className={`whitespace-nowrap ${className ?? ""}`}>
      <span className="figure">{money(value)}</span>
      <span className={signClassName}>{" "}₪</span>
    </span>
  );
}
