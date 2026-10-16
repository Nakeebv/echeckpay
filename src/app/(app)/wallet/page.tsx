import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { depositOrders, walletLedger } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { listLedger } from "@/lib/wallet";
import { formatCents } from "@/lib/amount";
import WalletDeposit from "@/components/WalletDeposit";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, string> = {
  finished: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  underpaid: "bg-amber-50 text-amber-800 ring-amber-200",
};

export default async function WalletPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [orders, ledger] = await Promise.all([
    db.select().from(depositOrders).where(eq(depositOrders.userId, user.id)).orderBy(desc(depositOrders.createdAt)).limit(10),
    listLedger(user.id, 15),
  ]);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Wallet</h1>
          <p className="mt-1 text-sm text-slate-600">
            Balance funds printing — each printed check costs $10.00.
          </p>
        </div>
        <div className="rounded-2xl bg-[#1d1d1f] px-6 py-4 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Available balance
          </div>
          <div className="text-3xl font-bold tabular-nums">{formatCents(user.balanceCents)}</div>
        </div>
      </section>

      <WalletDeposit balanceCents={user.balanceCents} />

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Recent deposits</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {orders.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No deposits yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatCents(o.priceUsdCents)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          STATUS_TONES[o.status] ?? "bg-blue-50 text-blue-700 ring-blue-200"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/wallet/${o.id}`} className="text-[11px] font-semibold text-[#0071e3] hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Ledger</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {ledger.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-slate-800">
                        {l.kind === "deposit"
                          ? "Deposit"
                          : l.kind === "print_charge"
                            ? "Print charge"
                            : "Admin adjustment"}
                      </div>
                      <div className="text-xs text-slate-500">{l.memo}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono text-sm font-semibold tabular-nums ${
                        l.amountCents >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {l.amountCents >= 0 ? "+" : "−"}
                      {formatCents(Math.abs(l.amountCents))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
