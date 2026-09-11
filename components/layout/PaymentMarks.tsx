/** Compact payment acceptance marks for footer (not official trademark assets). */
export function PaymentMarks() {
  return (
    <ul
      className="mt-3 flex flex-wrap items-center gap-2"
      aria-label="Kabul edilen ödeme yöntemleri"
    >
      <li>
        <span className="inline-flex h-7 items-center rounded border border-line bg-surface px-2 text-[10px] font-semibold tracking-wide text-charcoal">
          PayTR
        </span>
      </li>
      <li>
        <span className="inline-flex h-7 items-center gap-1 rounded border border-line bg-surface px-2">
          <VisaMark />
          <span className="sr-only">Visa</span>
        </span>
      </li>
      <li>
        <span className="inline-flex h-7 items-center gap-1 rounded border border-line bg-surface px-2">
          <MastercardMark />
          <span className="sr-only">Mastercard</span>
        </span>
      </li>
    </ul>
  );
}

function VisaMark() {
  return (
    <svg viewBox="0 0 48 16" className="h-3.5 w-10" aria-hidden="true">
      <text
        x="0"
        y="13"
        fill="#1A1F71"
        fontFamily="Arial, sans-serif"
        fontSize="14"
        fontWeight="700"
        letterSpacing="0.5"
      >
        VISA
      </text>
    </svg>
  );
}

function MastercardMark() {
  return (
    <svg viewBox="0 0 36 22" className="h-4 w-7" aria-hidden="true">
      <circle cx="13" cy="11" r="9" fill="#EB001B" />
      <circle cx="23" cy="11" r="9" fill="#F79E1B" />
      <path
        d="M18 4.8a9 9 0 0 1 0 12.4 9 9 0 0 1 0-12.4z"
        fill="#FF5F00"
      />
    </svg>
  );
}
