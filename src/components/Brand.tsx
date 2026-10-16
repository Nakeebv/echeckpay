import Link from "next/link";

/** Logomark + wordmark. Ink tile with a check-glyph, used across the app. */
export default function Brand({
  href = "/",
  compact = false,
  className = "",
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="eCheckPay home"
      className={`group inline-flex items-center gap-2 ${className}`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-slate-900 text-white shadow-[0_1px_2px_rgba(12,13,17,0.28)] transition group-hover:bg-slate-950">
        <svg
          viewBox="0 0 24 24"
          className="h-[15px] w-[15px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12.5 4.2 4.2L19 6.5" />
        </svg>
      </span>
      {compact ? null : (
        <span className="text-[17px] font-semibold tracking-tight text-slate-900">eCheckPay</span>
      )}
    </Link>
  );
}
