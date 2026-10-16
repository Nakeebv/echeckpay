import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { depositOrders, supportThreads, users, checks } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { formatCents } from "@/lib/amount";
import { listAllAudits } from "@/lib/data";
import AdminConsole, { type AdminUser } from "@/components/AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const [userRows, orders, threads, audits] = await Promise.all([
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
    db.select().from(depositOrders).orderBy(desc(depositOrders.createdAt)).limit(20),
    db
      .select({
        id: supportThreads.id,
        subject: supportThreads.subject,
        status: supportThreads.status,
        updatedAt: supportThreads.updatedAt,
        userEmail: users.email,
        userId: supportThreads.userId,
      })
      .from(supportThreads)
      .innerJoin(users, eq(supportThreads.userId, users.id))
      .orderBy(desc(supportThreads.updatedAt))
      .limit(30),
    listAllAudits(20),
  ]);

  const adminUsers: AdminUser[] = userRows.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified === 1,
    balanceCents: u.balanceCents,
    checkCount: u.checkCount,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin</h1>
        <p className="mt-1 text-sm text-slate-600">
          Users, payments, complaints and the platform audit trail.
        </p>
      </section>

      <AdminConsole users={adminUsers} />

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Recent deposit orders</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {orders.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin?user=${o.userId}`} className="text-xs font-semibold text-[#0071e3] hover:underline">
                        #{o.userId}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{formatCents(o.priceUsdCents)}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold">{o.status}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{o.updatedAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Support &amp; complaints</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {threads.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No support threads.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {threads.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{t.subject}</div>
                    <div className="text-xs text-slate-500">
                      {t.userEmail} · updated {t.updatedAt.toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                      t.status === "open"
                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                        : t.status === "answered"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-slate-100 text-slate-600 ring-slate-200"
                    }`}
                  >
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Replies: open a thread from the user list or the support API console — message threads
          are managed server-side at <span className="font-mono">/api/admin/support</span>.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Platform audit trail</h2>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {audits.map((a) => (
            <div key={a.id} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold capitalize text-slate-800">{a.action}</span>
                <span className="text-[10px] text-slate-400">{a.createdAt.toLocaleString()}</span>
              </div>
              <div className="text-xs text-slate-600">{a.detail || "—"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
