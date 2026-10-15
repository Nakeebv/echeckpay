"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckBack, CheckSheet, SheetDetachGuides, type CheckAccountView, type CheckView } from "@/components/CheckDocument";
import { getLayout, type LayoutId } from "@/lib/layouts";

/**
 * Print output. Each face is a separate letter page so duplex printing puts the
 * reverse on the back of the correct sheet. The reverse prints at the same x
 * offset as the fronts so wallet-3 stock lines up after re-feeding.
 */
export default function PrintView({
  account,
  check,
  layoutId,
  layoutName,
  checkId,
  status,
  blockers,
  blockingLabels,
}: {
  account: CheckAccountView;
  check: CheckView;
  layoutId: LayoutId;
  layoutName?: string;
  checkId: number;
  status: string;
  blockers: number;
  blockingLabels: string[];
}) {
  const [includeBack, setIncludeBack] = useState(true);
  const [copies, setCopies] = useState(1);
  const layout = getLayout(layoutId);

  const dead = status === "void" || status === "stopped";
  const specimen = status === "cleared";
  const watermark: "none" | "void" | "specimen" = dead ? "void" : specimen ? "specimen" : "none";
  const reprinting = dead || specimen;
  const printable = blockers === 0 && status !== "void" && status !== "stopped";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mr-auto">
          <div className="text-sm font-bold text-slate-900">
            Print check #{check.checkNumber} — {layoutName}
          </div>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-600">
            In the browser print dialog choose <strong>Letter</strong>, <strong>Scale: 100% / Actual
            size</strong> (never &ldquo;Fit to page&rdquo;), <strong>margins: none</strong> and turn
            <strong> background graphics ON</strong>. Cut along the dashed{" "}
            <strong>✂ DETACH HERE</strong> lines to separate the check from the sheet — the reverse
            page carries the same guides so both sides cut in register.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={includeBack}
            onChange={(e) => setIncludeBack(e.target.checked)}
          />
          Include reverse page
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          Instruments on sheet
          <input
            type="number"
            min={1}
            max={3}
            value={copies}
            onChange={(e) => setCopies(Math.min(3, Math.max(1, Number(e.target.value) || 1)))}
            className="w-12 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <button
          type="button"
          disabled={!printable}
          onClick={() => window.print()}
          title={printable ? undefined : "Fix the blocking issues below first."}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          ⎙ Print
        </button>
        <Link
          href={`/checks/${checkId}`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to check
        </Link>
      </div>

      {blockers > 0 ? (
        <div className="no-print rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs leading-relaxed text-rose-900">
          <strong>Printing is blocked — {blockers} bank-acceptance requirement{blockers === 1 ? "" : "s"} fail.</strong>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {blockingLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <div className="mt-1.5">
            Edit the draft or its account before printing — a blocked document will be refused at the
            bank of first deposit.
          </div>
        </div>
      ) : null}

      {reprinting ? (
        <div className="no-print rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <strong>
            Status: {status}. Every instrument on this sheet prints with a &ldquo;
            {dead ? "VOID — DO NOT PRESENT" : "SPECIMEN"}&rdquo; watermark and is NOT negotiable.
          </strong>{" "}
          Printing a void/stopped item is for your records only. To issue a replacement, write a new
          check with the next serial.
        </div>
      ) : null}

      <div className="no-print rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <strong>Status: {status}.</strong> MICR readability depends on physical output: use a laser
        printer with magnetic (iron-oxide) MICR toner, or print on blank check stock that already
        carries a magnetic MICR line. Verify the baseline sits 3/16&rdquo; from the bottom trim edge
        and that the Transit field starts 5/16&rdquo; from the right edge using an E-13B position
        gauge, then transmit the Positive Pay file.
      </div>

      <div className="overflow-auto rounded-xl bg-slate-300/60 p-6">
        <div className="print-root mx-auto w-fit space-y-6">
          <div className="print-page">
            <CheckSheet
              account={account}
              check={check}
              layoutId={layoutId}
              copies={copies}
              watermark={watermark}
            />
          </div>
          {includeBack ? (
            <div className="print-page">
              <div
                className="doc-shadow relative"
                style={{
                  width: `${layout.page.width}in`,
                  height: `${layout.page.height}in`,
                  background: "#fff",
                }}
              >
                {/* identical cut guides so the reverse cuts in register */}
                <SheetDetachGuides layout={layout} />
                {/* same x/top as the fronts so duplex re-feed lines up */}
                <div
                  style={{
                    position: "absolute",
                    left: `${layout.offsets[0][0]}in`,
                    top: `${layout.offsets[0][1]}in`,
                  }}
                >
                  <CheckBack account={account} check={check} layoutId={layoutId} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
