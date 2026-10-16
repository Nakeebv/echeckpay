"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckBack, CheckFace, type CheckAccountView, type CheckView } from "@/components/CheckDocument";
import { CompliancePanel } from "@/components/CompliancePanel";
import { Badge, Card } from "@/components/ui";
import { formatCents, legalAmount } from "@/lib/amount";
import { getLayout, type LayoutId } from "@/lib/layouts";
import { evaluateCompliance, nextStatuses } from "@/lib/security";

export type CheckDetailProps = {
  check: CheckView & {
    id: number;
    layout: string;
    status: string;
    payeeAddress: string;
    accountId: number;
    statusReason: string;
  };
  account: CheckAccountView;
  accountLabel: string;
  onUsFormat: string;
  audit: { id: number; action: string; detail: string; actor: string; createdAt: string }[];
  duplicateSerial: boolean;
};

const ACTION_META: Record<string, { label: string; tone: string; needsReason: boolean }> = {
  printed: { label: "Mark printed", tone: "border-slate-300 bg-white text-slate-700", needsReason: false },
  issued: { label: "Mark issued", tone: "border-slate-300 bg-white text-slate-700", needsReason: false },
  cleared: { label: "Mark cleared", tone: "border-emerald-300 bg-emerald-50 text-emerald-800", needsReason: false },
  stopped: { label: "Stop payment", tone: "border-amber-300 bg-amber-50 text-amber-800", needsReason: true },
  void: { label: "Void", tone: "border-rose-300 bg-rose-50 text-rose-800", needsReason: true },
};

export default function CheckDetail({
  check,
  account,
  accountLabel,
  onUsFormat,
  audit,
  duplicateSerial,
}: CheckDetailProps) {
  const router = useRouter();
  const [side, setSide] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(0.95);
  const [busy, setBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const chargeKey = useRef<string>(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const layoutId = ((check.layout as LayoutId) ?? "wallet") as LayoutId;
  const layout = getLayout(layoutId);

  const compliance = useMemo(
    () =>
      evaluateCompliance({
        routingNumber: account.routingNumber,
        accountNumber: account.accountNumber,
        checkNumber: String(check.checkNumber),
        amountCents: check.amountCents,
        dateIssued: check.dateIssued,
        payeeName: check.payeeName,
        layout: layoutId,
        features: check.features ?? [],
        signatureMode: check.signatureMode,
        onUsFormat: onUsFormat as never,
        includeAmountField: check.includeAmountField,
        duplicateSerial,
      }),
    [account, check, layoutId, onUsFormat, duplicateSerial],
  );

  const nexts = nextStatuses(check.status);

  async function transition(status: string, statusReason = "") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/checks/${check.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, statusReason }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { errors?: string[] };
        setError((data.errors ?? ["Could not update the check."]).join(" "));
        return;
      }
      setPendingStatus(null);
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    setBusy(true);
    try {
      await fetch(`/api/checks/${check.id}`, { method: "DELETE" });
      router.push("/checks");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {accountLabel}
              </div>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
                Check #{check.checkNumber}
              </h1>
              <div className="mt-1 text-sm text-slate-600">
                {check.payeeName} · {formatCents(check.amountCents)} · {check.dateIssued}
              </div>
            </div>
            <Badge
              tone={
                check.status === "cleared"
                  ? "green"
                  : check.status === "void" || check.status === "stopped"
                    ? "rose"
                    : check.status === "draft"
                      ? "slate"
                      : "teal"
              }
            >
              {check.status}
            </Badge>
          </div>

          {check.statusReason ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold uppercase tracking-wider text-slate-500">Reason:</span>{" "}
              {check.statusReason}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          ) : null}

          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Legal amount
              </dt>
              <dd className="mt-0.5 font-semibold">{legalAmount(check.amountCents)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Courtesy amount
              </dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums">
                {formatCents(check.amountCents)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Memo
              </dt>
              <dd className="mt-0.5">{check.memo || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Document format
              </dt>
              <dd className="mt-0.5">
                {layout.name} ({layout.width}&quot; × {layout.height}&quot;)
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Routing / account
              </dt>
              <dd className="mt-0.5 font-mono">
                {account.routingNumber} / {account.accountNumber}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Fraction
              </dt>
              <dd className="mt-0.5 font-mono">{account.fraction || "—"}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={printBusy}
              onClick={async () => {
                setPrintBusy(true);
                setError(null);
                try {
                  const res = await fetch("/api/print/charge", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ checkId: check.id, chargeKey: chargeKey.current }),
                  });
                  const data = (await res.json()) as { printUrl?: string; errors?: string[] };
                  if (!res.ok || !data.printUrl) {
                    setError((data.errors ?? ["Could not charge the print."]).join(" "));
                    return;
                  }
                  router.push(data.printUrl);
                } finally {
                  setPrintBusy(false);
                }
              }}
              className="rounded-full bg-[#0071e3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-50"
            >
              {printBusy ? "Processing…" : `Print — $10`}
            </button>
            {error ? (
              <span className="self-center text-xs font-semibold text-rose-700">{error}</span>
            ) : null}
            {check.status === "draft" ? (
              <Link
                href={`/write?edit=${check.id}`}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ✎ Edit draft
              </Link>
            ) : null}
            <a
              href={`/api/positive-pay?accountId=${check.accountId}`}
              className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ⤓ Positive Pay file
            </a>
            {check.status === "draft" && !confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Delete draft
              </button>
            ) : null}
            {check.status === "draft" && confirmDelete ? (
              <span className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800">
                Delete draft #{check.checkNumber} permanently?
                <button
                  type="button"
                  disabled={busy}
                  onClick={deleteDraft}
                  className="rounded bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded border border-rose-300 px-2 py-1 text-[11px] font-bold text-rose-700"
                >
                  Cancel
                </button>
              </span>
            ) : null}
            {nexts.map((s) => {
              const meta = ACTION_META[s];
              if (!meta) return null;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (meta.needsReason) {
                      setPendingStatus(s);
                      setReason("");
                    } else {
                      void transition(s);
                    }
                  }}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition hover:brightness-95 disabled:opacity-50 ${meta.tone}`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          {pendingStatus ? (
            <form
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (pendingStatus) void transition(pendingStatus, reason);
              }}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                {pendingStatus === "void" ? "Void check" : "Stop payment"} — reason required
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                The reason is saved with the check and shown in the history. The check stays in your
                history so the sequence stays complete.
              </p>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  pendingStatus === "void"
                    ? "e.g. Printed with the wrong payee — re-issued as #1004"
                    : "e.g. Payee did not receive the item — placed stop on 10/14"
                }
                className="mt-2 w-full rounded-md border border-amber-300 bg-white px-2.5 py-2 text-sm"
                required
                minLength={4}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={busy || reason.trim().length < 4}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setPendingStatus(null)}
                  className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-slate-900">History</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            A permanent record of everything that happened to this check.
          </p>
          <ol className="mt-3 space-y-2">
            {audit.map((a) => (
              <li key={a.id} className="flex gap-3 text-xs">
                <span className="mt-1 h-2 w-2 flex-none rounded-full bg-teal-500" />
                <div>
                  <div className="font-semibold capitalize text-slate-800">{a.action}</div>
                  <div className="text-slate-600">{a.detail}</div>
                  <div className="text-slate-400">
                    {new Date(a.createdAt).toLocaleString()} · {a.actor}
                  </div>
                </div>
              </li>
            ))}
            {audit.length === 0 ? <li className="text-xs text-slate-500">No events recorded.</li> : null}
          </ol>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-slate-300 bg-slate-100 p-0.5">
              {(["front", "back"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSide(s)}
                  className={`rounded px-3 py-1 text-xs font-semibold capitalize ${
                    side === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              Zoom
              <input
                type="range"
                min={0.45}
                max={1.6}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="overflow-auto rounded-lg bg-black p-4">
            <div
              className="check-scale doc-shadow mx-auto"
              style={{
                zoom,
                width: `${layout.width * 96}px`,
                height: `${layout.height * 96}px`,
                background: "#fff",
              }}
            >
              {side === "front" ? (
                <CheckFace
                  account={account}
                  check={check}
                  layoutId={layoutId}
                  watermark={check.status === "void" || check.status === "stopped" ? "void" : check.status === "cleared" ? "specimen" : "none"}
                />
              ) : (
                <CheckBack account={account} check={check} layoutId={layoutId} />
              )}
            </div>
          </div>
          {check.status === "void" || check.status === "stopped" || check.status === "cleared" ? (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
              This check is {check.status} — the document preview carries a non-negotiable watermark
              and will print with one too.
            </p>
          ) : null}
        </Card>

        <CompliancePanel result={compliance} />
      </div>
    </div>
  );
}
