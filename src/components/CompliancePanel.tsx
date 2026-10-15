"use client";

import { useState } from "react";
import type { ComplianceResult, ComplianceCheck } from "@/lib/security";
import { Badge, Card } from "@/components/ui";

function StatusIcon({ status }: { status: ComplianceCheck["status"] }) {
  if (status === "pass") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
        ✓
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
        !
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-700">
      ✕
    </span>
  );
}

export function CompliancePanel({ result }: { result: ComplianceResult }) {
  const [open, setOpen] = useState(false);
  const gradeTone =
    result.grade === "A"
      ? "bg-emerald-500"
      : result.grade === "B"
        ? "bg-teal-500"
        : result.grade === "C"
          ? "bg-amber-500"
          : "bg-rose-500";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div
          className={`relative flex h-14 w-14 flex-none items-center justify-center rounded-full text-white ${gradeTone}`}
          style={{
            background: `conic-gradient(currentColor ${result.score}%, rgba(148,163,184,0.28) ${result.score}%)`,
          }}
        >
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${gradeTone}`}
          >
            {result.grade}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">
            Bank-acceptance score {result.score}/100
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <Badge tone={result.blockers ? "rose" : "green"}>
              {result.blockers} blocking {result.blockers === 1 ? "issue" : "issues"}
            </Badge>
            <Badge tone={result.warnings ? "amber" : "green"}>{result.warnings} advisories</Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>

      <div className="border-b border-slate-200 bg-slate-900 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Machine-read check numbers
        </div>
        <div className="mt-1 break-all font-mono text-[13px] font-semibold tracking-widest text-teal-300">
          {result.micrText || "—"}
        </div>
        {result.micrErrors.length ? (
          <ul className="mt-2 space-y-1 text-[11px] text-rose-300">
            {result.micrErrors.map((e) => (
              <li key={e}>✕ {e}</li>
            ))}
          </ul>
        ) : null}
        {result.micrWarnings.length ? (
          <ul className="mt-1 space-y-1 text-[11px] text-amber-300">
            {result.micrWarnings.map((w) => (
              <li key={w}>! {w}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {open ? (
        <ul className="divide-y divide-slate-100">
          {result.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
              <StatusIcon status={c.status} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold text-slate-900">{c.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                    {c.standard}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
