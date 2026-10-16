import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, SectionTitle, StatCard } from "@/components/ui";
import { getStats, listChecks, listRecentAudits } from "@/lib/data";
import { formatCents } from "@/lib/amount";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — eCheckPay",
};

const ACTIONS = [
  {
    href: "/write",
    title: "Write a check",
    body: "Fill in the payee and amount, then print a bank-ready document.",
  },
  {
    href: "/checks",
    title: "History",
    body: "Every check you have written, with status and exports.",
  },
  {
    href: "/accounts",
    title: "Accounts",
    body: "Bank accounts, check numbering and letterhead.",
  },
  {
    href: "/payees",
    title: "Payees",
    body: "People and businesses you write checks to.",
  },
];

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [stats, recent, audits] = await Promise.all([
    getStats(user.id),
    listChecks(user.id, 6),
    listRecentAudits(user.id, 8),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="text-base font-semibold text-slate-900 group-hover:text-[#0071e3]">
                {a.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{a.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Bank accounts" value={String(stats.accounts)} />
        <StatCard label="Payees" value={String(stats.payees)} />
        <StatCard label="Checks written" value={String(stats.checks)} tone="teal" />
        <StatCard label="Outstanding" value={formatCents(stats.outstandingCents)} tone="amber" hint="Not yet cleared" />
        <StatCard label="Cleared" value={formatCents(stats.clearedCents)} tone="teal" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle
            title="Recent checks"
            right={
              <Link href="/checks" className="text-sm font-semibold text-[#0071e3] hover:underline">
                History →
              </Link>
            }
          />
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Check</th>
                  <th className="px-4 py-2.5">Payee</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">
                      <Link href={`/checks/${r.id}`} className="hover:underline">
                        #{r.checkNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{r.payeeName}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatCents(r.amountCents)}</td>
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
                  </tr>
                ))}
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No checks yet — <Link href="/write" className="font-semibold text-[#0071e3]">write one</Link>.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <SectionTitle title="Activity" subtitle="Who did what, and when." />
          <Card className="divide-y divide-slate-100">
            {audits.map((a) => (
              <div key={a.id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold capitalize text-slate-800">{a.action}</span>
                  <span className="text-[10px] text-slate-400">
                    {a.createdAt.toLocaleString()} · {a.actor}
                  </span>
                </div>
                <div className="text-xs text-slate-600">{a.detail || "—"}</div>
              </div>
            ))}
            {audits.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">No events yet.</div>
            ) : null}
          </Card>
        </div>
      </section>

      <section>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="text-sm font-semibold text-slate-900">Printing standards guide</div>
            <p className="mt-0.5 text-xs text-slate-500">
              Paper, toner and printer settings that keep every check readable at the bank.
            </p>
          </div>
          <Link
            href="/standards"
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open guide
          </Link>
        </Card>
      </section>
    </div>
  );
}
