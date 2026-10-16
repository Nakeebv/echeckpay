import type { ReactNode } from "react";

/** Shared text-input styling used across every form. */
export const inputCls = "field-base";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="cap-label">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] leading-relaxed text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card-surface ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "teal" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    teal: "text-[#2e51f0]",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <div className="stat-tile">
      <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums ${tones[tone]}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "teal" | "amber" | "rose" | "green" | "indigo";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    teal: "bg-[#2e51f0]/10 text-[#2440d4] ring-[#2e51f0]/20",
    indigo: "bg-[#2e51f0]/10 text-[#2440d4] ring-[#2e51f0]/20",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}
