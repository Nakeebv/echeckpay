"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/amount";

export default function AdminUserActions({
  userId,
  status,
  balanceCents,
}: {
  userId: number;
  status: string;
  balanceCents: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, userId, ...extra }),
      });
      const data = (await res.json()) as { ok?: boolean; link?: string; errors?: string[] };
      if (!res.ok) {
        setNote((data.errors ?? ["Action failed."]).join(" "));
        return;
      }
      if (action === "reset_link" && data.link) {
        setResetLink(data.link);
        setNote("Reset link created — send it to the user privately.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function adjust(sign: 1 | -1) {
    const input = window.prompt(`${sign > 0 ? "Add" : "Remove"} funds ($)`);
    if (!input) return;
    const dollars = Number(input);
    if (!Number.isFinite(dollars) || dollars === 0) return;
    let memo = window.prompt("Reason (audited):") ?? "";
    if (!memo.trim()) memo = `${sign > 0 ? "credit" : "debit"} by admin`;
    await act("adjust", { amountCents: Math.round(dollars * 100) * sign, memo });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "active" ? (
          <button type="button" disabled={busy} onClick={() => void act("block")} className="btn btn-ghost !text-amber-800">
            Block account
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void act("unblock")} className="btn btn-ghost !text-emerald-700">
            Unblock account
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Issue a one-time password reset link for this user?")) void act("reset_link");
          }}
          className="btn btn-ghost"
        >
          Reset their password
        </button>
        <button type="button" disabled={busy} onClick={() => void adjust(1)} className="btn btn-sm btn-ghost !text-emerald-700 self-center">
          + Add funds
        </button>
        <button type="button" disabled={busy} onClick={() => void adjust(-1)} className="btn btn-sm btn-ghost !text-rose-600 self-center">
          − Remove funds
        </button>
        <span className="self-center text-xs text-slate-400">Current balance: {formatCents(balanceCents)}</span>
      </div>

      {note ? <p className="text-xs font-semibold text-slate-600">{note}</p> : null}
      {resetLink ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          One-time reset link (expires in 60 minutes):
          <div className="mt-1 break-all rounded border border-emerald-300 bg-white px-2 py-1.5 font-mono">{resetLink}</div>
        </div>
      ) : null}
    </div>
  );
}
