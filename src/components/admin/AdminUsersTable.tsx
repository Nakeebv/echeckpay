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

export type AdminOrder = {
  id: string;
  userEmail: string;
  priceUsdCents: number;
  status: string;
  createdAt: string;
};

export default function AdminUsersTable({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resetLink, setResetLink] = useState<{ id: number; link: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const shown = users.filter(
    (u) => !filter || u.email.toLowerCase().includes(filter.toLowerCase()),
  );

  async function act(userId: number, action: string, extra?: Record<string, unknown>) {
    setBusyId(userId);
    setNote(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, userId, ...extra }),
      });
      const data = (await res.json()) as { ok?: boolean; link?: string; errors?: string[]; balanceAfterCents?: number };
      if (!res.ok) {
        setNote((data.errors ?? ["Action failed."]).join(" "));
        return;
      }
      if (action === "reset_link" && data.link) {
        setResetLink({ id: userId, link: data.link });
        setNote("Reset link created — send it to the user privately.");
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function adjust(userId: number, sign: 1 | -1) {
    const input = window.prompt(`${sign > 0 ? "Add" : "Remove"} funds ($)`);
    if (!input) return;
    const dollars = Number(input);
    if (!Number.isFinite(dollars) || dollars === 0) return;
    let memo = window.prompt(`Reason (audited):`) ?? "";
    if (!memo.trim()) memo = `manual ${sign > 0 ? "credit" : "debit"} by admin`;
    await act(userId, "adjust", { amountCents: Math.round(dollars * 100) * sign, memo });
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-[#16171c]">Users</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search email…"
          className="w-48 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#2e51f0]"
        />
      </div>

      {note ? (
        <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{note}</p>
      ) : null}
      {resetLink ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Reset link for user #{resetLink.id}:
          <div className="mt-1 break-all rounded border border-emerald-300 bg-white px-2 py-1.5 font-mono">{resetLink.link}</div>
        </div>
      ) : null}

      <div className="table-stack overflow-hidden card-surface">
        <table className="w-full min-w-[760px] text-sm table-collapse-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Balance</th>
              <th className="px-4 py-2.5">Checks</th>
              <th className="px-4 py-2.5">Detail</th>
              <th className="px-4 py-2.5 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {shown.map((u) => (
              <tr key={u.id}>
                <td data-label="User">
                  <div className="font-medium text-slate-800">{u.email}</div>
                  <div className="text-[10px] text-slate-400">
                    #{u.id} · joined {new Date(u.createdAt).toLocaleDateString()}
                    {u.emailVerified ? "" : " · email unverified"}
                  </div>
                </td>
                <td data-label="Role" className="text-xs">{u.role}</td>
                <td data-label="Status">
                  <span
                    className={`chip ${
                      u.status === "active"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td data-label="Balance" className="font-mono text-xs tabular-nums">{formatCents(u.balanceCents)}</td>
                <td data-label="Checks" className="text-xs tabular-nums">{u.checkCount}</td>
                <td data-label="Detail">
                  <a href={`/admin/users/${u.id}`} className="text-[11px] font-semibold text-[#2e51f0] hover:underline">
                    Open
                  </a>
                </td>
                <td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {u.role !== "admin" && u.status === "active" ? (
                      <button type="button" disabled={busyId === u.id} onClick={() => void act(u.id, "block")} className="btn btn-sm btn-ghost !text-amber-800">
                        Block
                      </button>
                    ) : null}
                    {u.status === "blocked" ? (
                      <button type="button" disabled={busyId === u.id} onClick={() => void act(u.id, "unblock")} className="btn btn-sm btn-ghost !text-emerald-700">
                        Unblock
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => {
                        if (window.confirm(`Issue a password reset link for ${u.email}?`)) void act(u.id, "reset_link");
                      }}
                      className="btn btn-sm btn-ghost"
                    >
                      Reset pw
                    </button>
                    <button type="button" disabled={busyId === u.id} onClick={() => void adjust(u.id, 1)} className="btn btn-sm btn-ghost !text-emerald-700">+$</button>
                    <button type="button" disabled={busyId === u.id} onClick={() => void adjust(u.id, -1)} className="btn btn-sm btn-ghost !text-rose-600">−$</button>
                    {u.role !== "admin" ? (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => {
                          if (window.confirm(`Delete ${u.email}? Records are preserved.`)) void act(u.id, "delete");
                        }}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No users match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
