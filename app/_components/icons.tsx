/** The handful of glyphs this one screen needs, drawn inline so they take the
 *  colour of the text around them and cost no request. All are decorative: the
 *  control each sits in carries its own label. */

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" />
      <path d="M16.6 3.2v3.4h-3.4" />
    </Svg>
  );
}

export function SignOutIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 3.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h3" />
      <path d="M12.5 13.5 16 10l-3.5-3.5M16 10H8" />
    </Svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="m6.9 10.2 2.1 2.1 4.1-4.4" />
    </Svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.4v4.2M10 13.4v.2" />
    </Svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="7" y="7" width="9.5" height="9.5" rx="1.5" />
      <path d="M13 7V5A1.5 1.5 0 0 0 11.5 3.5H5A1.5 1.5 0 0 0 3.5 5v6.5A1.5 1.5 0 0 0 5 13h2" />
    </Svg>
  );
}

export function Spinner({ className }: IconProps) {
  return (
    <Svg className={`animate-spin ${className ?? ""}`}>
      <path d="M10 3.5a6.5 6.5 0 1 0 6.5 6.5" />
    </Svg>
  );
}
