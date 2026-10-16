"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/amount";
import type { AdminOrder } from "./AdminUsersTable";

const TONES: Record<string, string> = {
  finished: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-200",
  refunded: "bg-slate-100 text-slate-600 ring-slate-200",
  underpaid: "bg-amber-50 text-amber-800 ring-amber-200",
};

export default function AdminOrders({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function recheck(orderId: string) {
    setBusyId(orderId);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refresh`, { method: "POST" });
      const data = (await res.json()) as { errors?: string[] };
      if (!res.ok) {
        setNote((data.errors ?? ["Provider check failed."]).join(" "));
        return;
      }
      setNote("Order re-checked against NOWPayments.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      {note ? (
        <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{note}</p>
      ) : null}
      <div className="table-stack overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm table-collapse-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Created</th>
              <th className="px-4 py-2.5 text-right">Reconcile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {orders.map((o) => (
              <tr key={o.id}>
                <td data-label="Order" className="px-4 py-2.5 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                <td data-label="User" className="px-4 py-2.5 text-xs">{o.userEmail}</td>
                <td data-label="Amount" className="px-4 py-2.5 tabular-nums">{formatCents(o.priceUsdCents)}</td>
                <td data-label="Status" className="px-4 py-2.5">
                  <span className={`chip ring-1 ring-inset ${TONES[o.status] ?? "bg-blue-50 text-blue-700 ring-blue-200"}`}>
                    {o.status}
                  </span>
                </td>
                <td data-label="Created" className="px-4 py-2.5 text-xs text-slate-400">
                  {new Date(o.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    onClick={() => void recheck(o.id)}
                    className="btn btn-sm btn-ghost"
                  >
                    {busyId === o.id ? "Checking…" : "Re-check"}
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No orders yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
