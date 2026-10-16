"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/amount";

export type AdminUser = {
  id: number;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  balanceCents: number;
  checkCount: number;
  createdAt: string;
};

export default function AdminConsole({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resetLink, setResetLink] = useState<{ id: number; link: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(userId: number, action: string, extra?: Record<string, unknown>) {
    setBusyId(userId);
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
        setResetLink({ id: userId, link: data.link });
        setNote("Reset link created — give it to the user out-of-band (chat/email).");
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function adjust(userId: number, sign: 1 | -1) {
    const input = window.prompt(`${sign > 0 ? "Add" : "Remove"} funds (dollars):`);
    if (!input) return;
    const dollars = Number(input);
    if (!Number.isFinite(dollars) || dollars === 0) return;
    const amountCents = Math.round(dollars * 100) * sign;
    const memo = window.prompt(`Reason for ${sign > 0 ? "crediting" : "debiting"} ${Math.abs(dollars)}:`) ?? "";
    await act(userId, "adjust", { amountCents, memo });
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Users</h2>
      {note ? (
        <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{note}</p>
      ) : null}
      {resetLink ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Reset link for user #{resetLink.id}:
          <div className="mt-1 break-all rounded border border-emerald-300 bg-white px-2 py-1.5 font-mono">
            {resetLink.link}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Balance</th>
              <th className="px-4 py-2.5">Checks</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">{u.email}</div>
                  <div className="text-[10px] text-slate-400">
                    #{u.id} · joined {new Date(u.createdAt).toLocaleDateString()}
                    {u.emailVerified ? "" : " · email unverified"}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs">{u.role}</td>
                <td className="px-4 py-2.5 text-xs font-semibold capitalize">{u.status}</td>
                <td className="px-4 py-2.5 font-mono text-xs tabular-nums">{formatCents(u.balanceCents)}</td>
                <td className="px-4 py-2.5 text-xs tabular-nums">{u.checkCount}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {u.role !== "admin" && u.status === "active" ? (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => void act(u.id, "block")}
                        className="rounded border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-50"
                      >
                        Block
                      </button>
                    ) : null}
                    {u.status === "blocked" ? (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => void act(u.id, "unblock")}
                        className="rounded border border-emerald-300 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50"
                      >
                        Unblock
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void act(u.id, "reset_link")}
                      className="rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void adjust(u.id, 1)}
                      className="rounded border border-emerald-300 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50"
                    >
                      +$
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void adjust(u.id, -1)}
                      className="rounded border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
                    >
                      −$
                    </button>
                    {u.role !== "admin" ? (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => {
                          if (window.confirm(`Delete ${u.email}? (soft delete — records preserved)`)) {
                            void act(u.id, "delete");
                          }
                        }}
                        className="rounded border border-rose-300 px-2 py-1 text-[10px] font-bold text-rose-800 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
