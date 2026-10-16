import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { checks, depositOrders, supportThreads, users } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { formatCents } from "@/lib/amount";
import { listAllAudits } from "@/lib/data";
import AdminUsersTable, { type AdminUser } from "@/components/admin/AdminUsersTable";
import AdminOrders from "@/components/admin/AdminOrders";
import AdminSupport from "@/components/admin/AdminSupport";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const [userRows, orderRows, threadRows, audits, revenue] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        emailVerified: users.emailVerified,
        balanceCents: users.balanceCents,
        createdAt: users.createdAt,
        checkCount: sql<number>`(select count(*)::int from ${checks} where ${checks.userId} = ${users.id})`,
      })
      .from(users)
      .where(ne(users.status, "deleted"))
      .orderBy(desc(users.id))
      .limit(200),
    db.select().from(depositOrders).orderBy(desc(depositOrders.createdAt)).limit(25),
    db
      .select({
        id: supportThreads.id,
        subject: supportThreads.subject,
        status: supportThreads.status,
        updatedAt: supportThreads.updatedAt,
        userEmail: users.email,
      })
      .from(supportThreads)
      .innerJoin(users, eq(supportThreads.userId, users.id))
      .orderBy(desc(supportThreads.updatedAt))
      .limit(30),
    listAllAudits(20),
    db
      .select({ total: sql<number>`coalesce(sum(${depositOrders.priceUsdCents}), 0)::int` })
      .from(depositOrders)
      .where(eq(depositOrders.status, "finished")),
  ]);

  const stats = [
    { label: "Users", value: String(userRows.length), sub: `${userRows.filter((u) => u.status === "active").length} active` },
    { label: "Deposit revenue", value: formatCents(revenue[0]?.total ?? 0), sub: " finished payments" },
    { label: "Checks written", value: String(userRows.reduce((a, u) => a + u.checkCount, 0)), sub: "all users incl. drafts" },
    { label: "Open tickets", value: String(threadRows.filter((t) => t.status === "open").length), sub: `${threadRows.length} total` },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Admin console</h1>
        <p className="mt-1 text-sm text-slate-600">
          The operator desk — users, money flow, complaints and the audit record.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="stat-tile">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{s.label}</div>
              <div className="mt-1 truncate text-2xl font-bold tabular-nums text-[#1d1d1f]">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <AdminUsersTable
        users={userRows.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          status: u.status,
          emailVerified: u.emailVerified === 1,
          balanceCents: u.balanceCents,
          checkCount: u.checkCount,
          createdAt: u.createdAt.toISOString(),
        }))}
      />

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Deposit orders</h2>
        <AdminOrders
          orders={orderRows.map((o) => ({
            id: o.id,
            userEmail: userRows.find((u) => u.id === o.userId)?.email ?? `user ${o.userId}`,
            priceUsdCents: o.priceUsdCents,
            status: o.status,
            createdAt: o.createdAt.toISOString(),
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Complaints &amp; requests</h2>
        <AdminSupport
          threads={threadRows.map((t) => ({
            id: t.id,
            subject: t.subject,
            status: t.status,
            userEmail: t.userEmail,
            updatedAt: t.updatedAt.toISOString(),
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-[#1d1d1f]">Platform audit trail</h2>
        <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
          {audits.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No events yet.</p>
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
      </section>

      <p className="text-xs text-slate-400">
        Managing the public site?{" "}
        <Link href="/" className="underline">
          Open the welcome page
        </Link>
        .
      </p>
    </div>
  );
}
