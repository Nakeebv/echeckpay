import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, bankAccounts, checks, depositOrders, supportThreads, users, walletLedger } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { formatCents } from "@/lib/amount";
import AdminUserActions from "@/components/admin/AdminUserActions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await currentUser();
  if (!admin) redirect("/login");
  if (admin.role !== "admin") redirect("/dashboard");

  const userId = Math.trunc(Number((await params).id));
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.role === "admin") notFound();

  const [userChecks, accounts, orders, ledger, threads, audits] = await Promise.all([
    db.select().from(checks).where(eq(checks.userId, userId)).orderBy(desc(checks.id)).limit(50),
    db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId)).limit(20),
    db.select().from(depositOrders).where(eq(depositOrders.userId, userId)).orderBy(desc(depositOrders.createdAt)).limit(20),
    db.select().from(walletLedger).where(eq(walletLedger.userId, userId)).orderBy(desc(walletLedger.id)).limit(20),
    db.select().from(supportThreads).where(eq(supportThreads.userId, userId)).orderBy(desc(supportThreads.updatedAt)).limit(10),
    db.select().from(auditEvents).where(eq(auditEvents.userId, userId)).orderBy(desc(auditEvents.id)).limit(20),
  ]);

  const outstanding = userChecks.reduce(
    (a, c) => a + (["draft", "printed", "issued"].includes(c.status) ? c.amountCents : 0),
    0,
  );
  const accountCount = accounts.length;

  return (
    <div className="space-y-8">
      <Link href="/admin" className="text-sm font-semibold text-[#0071e3] hover:underline">
        ← Admin console
      </Link>

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">{target.email}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>#{target.id}</span>
            <span className="capitalize">{target.role}</span>
            <span className={`capitalize font-semibold ${target.status === "active" ? "text-emerald-700" : "text-amber-700"}`}>{target.status}</span>
            <span>{target.emailVerified === 1 ? "email verified" : "email unverified"}</span>
            <span>joined {target.createdAt.toLocaleDateString()}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-[#1d1d1f] px-6 py-4 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Balance</div>
          <div className="text-3xl font-bold tabular-nums">{formatCents(target.balanceCents)}</div>
        </div>
      </section>

      <AdminUserActions userId={target.id} status={target.status} balanceCents={target.balanceCents} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Checks ({userChecks.length})</h2>
          <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
            {userChecks.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No checks.</p>
            ) : (
              userChecks.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">#{c.checkNumber} → {c.payeeName}</div>
                    <div className="text-xs text-slate-500">{c.status} · {c.dateIssued}</div>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums">{formatCents(c.amountCents)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Bank accounts ({accountCount})</h2>
          <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
            {accounts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No accounts.</p>
            ) : (
              accounts.map((a) => (
                <div key={a.id} className="px-4 py-2.5">
                  <div className="text-sm font-semibold text-slate-800">{a.label}</div>
                  <div className="text-xs text-slate-500">{a.bankName} ·····{a.accountNumber.slice(-4)} · {a.accountClass}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Deposits</h2>
          <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
            {orders.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No deposits.</p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-slate-600">{o.id.slice(0, 8)}…</div>
                    <div className="text-xs text-slate-500">{o.createdAt.toLocaleString()}</div>
                  </div>
                  <span className="text-xs font-semibold">{formatCents(o.priceUsdCents)}</span>
                  <span className="text-xs font-semibold capitalize">{o.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Ledger</h2>
          <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
            {ledger.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No transactions.</p>
            ) : (
              ledger.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm capitalize text-slate-800">{l.kind.replace("_", " ")}</div>
                    <div className="text-xs text-slate-500">{l.memo || l.kind}</div>
                  </div>
                  <span className={`font-mono text-xs font-bold ${l.amountCents >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {l.amountCents >= 0 ? "+" : "−"}{formatCents(Math.abs(l.amountCents))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Support threads</h2>
          <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
            {threads.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No threads.</p>
            ) : (
              threads.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-sm font-medium text-slate-800">{t.subject}</span>
                  <span className="text-xs capitalize text-slate-500">{t.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Audit trail</h2>
          <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
            {audits.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No events.</p>
            ) : (
              audits.map((a) => (
                <div key={a.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold capitalize text-slate-800">{a.action}</span>
                    <span className="text-[10px] text-slate-400">{a.createdAt.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-slate-600">{a.detail || "—"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
