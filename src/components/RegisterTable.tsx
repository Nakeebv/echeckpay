"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { formatCents } from "@/lib/amount";

export type RegisterRowView = {
  id: number;
  checkNumber: number;
  payeeName: string;
  amountCents: number;
  dateIssued: string;
  status: string;
  memo: string;
  layout: string;
  accountId: number;
  accountLabel: string;
  accountNumber: string;
  routingNumber: string;
};

const STATUSES = ["all", "draft", "printed", "issued", "cleared", "void", "stopped"];

export default function RegisterTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: RegisterRowView[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [account, setAccount] = useState(0);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accounts = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((r) => map.set(r.accountId, r.accountLabel));
    return [...map.entries()];
  }, [rows]);

  const filtered = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (account === 0 || r.accountId === account) &&
      (q.trim() === "" ||
        `${r.payeeName} ${r.checkNumber} ${r.memo}`.toLowerCase().includes(q.toLowerCase())),
  );

  const outstanding = filtered
    .filter((r) => ["draft", "printed", "issued"].includes(r.status))
    .reduce((a, r) => a + r.amountCents, 0);

  const clearState = filtered
    .filter((r) => r.status === "cleared")
    .reduce((a, r) => a + r.amountCents, 0);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function askReason(kind: "void" | "stopped") {
    const reason =
      kind === "void"
        ? window.prompt(`Void ${selected.size} check(s)? Give a short reason for your records:`)
        : window.prompt(`Stop payment on ${selected.size} check(s)? Give a short reason for your records:`);
    if (!reason || reason.trim().length < 4) return;
    void bulkTransition(kind, reason.trim());
  }

  async function bulkTransition(next: string, reason = "") {
    setBusy(true);
    setBulkError(null);
    try {
      const results = await Promise.all(
        [...selected].map((id) =>
          fetch(`/api/checks/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: next, statusReason: reason }),
          }),
        ),
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        const data = (await failed[0].json()) as { errors?: string[] };
        setBulkError(
          `${failed.length} of ${selected.size} update(s) failed: ${(data.errors ?? []).join(" ")}`,
        );
      }
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs font-semibold text-slate-600">
          <span className="mb-1 block uppercase tracking-wider">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Payee, check number or memo"
            className="w-56 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          <span className="mb-1 block uppercase tracking-wider">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          <span className="mb-1 block uppercase tracking-wider">Account</span>
          <select
            value={account}
            onChange={(e) => setAccount(Number(e.target.value))}
            className="max-w-64 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value={0}>All accounts</option>
            {accounts.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Outstanding / Cleared
          </div>
          <div className="text-lg font-bold tabular-nums text-amber-700">
            {formatCents(outstanding)}
            <span className="ml-2 text-sm font-semibold text-emerald-700">{formatCents(clearState)}</span>
          </div>
        </div>
        <a
          href={`/api/positive-pay${account ? `?accountId=${account}` : ""}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ⤓ Bank file
        </a>
        <a
          href={`/api/register/export${account ? `?accountId=${account}` : ""}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ⤓ Export CSV
        </a>
      </Card>

      {selected.size > 0 ? (
        <Card className="flex flex-wrap items-center gap-2 border-teal-300 bg-teal-50/60 p-3">
          <span className="text-xs font-bold text-teal-900">{selected.size} selected</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void bulkTransition("cleared")}
            className="rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            Mark cleared
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void bulkTransition("printed")}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Mark printed
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => askReason("void")}
            className="rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            Void…
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => askReason("stopped")}
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            Stop payment…
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
          >
            Clear selection
          </button>
        </Card>
      ) : null}
      {bulkError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {bulkError}
        </div>
      ) : null}

      {/* this is a bulk-action affordance that keeps reconciliation honest */}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2.5" />
              <th className="px-4 py-2.5">Check</th>
              <th className="px-4 py-2.5">Payee</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Account</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-teal-50/60" : "hover:bg-slate-50"}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select check ${r.checkNumber}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="px-4 py-2.5 font-mono font-bold tabular-nums">
                  <Link href={`/checks/${r.id}`} className="hover:underline">
                    {r.checkNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/checks/${r.id}`} className="hover:underline">
                    {r.payeeName}
                  </Link>
                  {r.memo ? (
                    <div className="text-[11px] text-slate-500">{r.memo}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {formatCents(r.amountCents)}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{r.dateIssued}</td>
                <td className="px-4 py-2.5 text-slate-500">····{r.accountNumber.slice(-4)}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    tone={
                      r.status === "cleared"
                        ? "green"
                        : r.status === "void" || r.status === "stopped"
                          ? "rose"
                          : r.status === "draft"
                            ? "slate"
                            : "teal"
                    }
                  >
                    {r.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/checks/${r.id}`}
                    className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                      r.status === "cleared" || r.status === "void" || r.status === "stopped"
                        ? "border-amber-300 text-amber-800 hover:bg-amber-50"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {r.status === "cleared" || r.status === "void" || r.status === "stopped"
                      ? "Reprint"
                      : "Print"}
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No checks here yet — <Link className="font-semibold text-[#0071e3]" href="/write">write one</Link>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Showing {rows.length} of {total} check records (newest first).
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={`/checks?page=${page - 1}`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Newer
            </Link>
          ) : null}
          <span className="text-xs font-semibold text-slate-600">
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          {page * pageSize < total ? (
            <Link
              href={`/checks?page=${page + 1}`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Older →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
