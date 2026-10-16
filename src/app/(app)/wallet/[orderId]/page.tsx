import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { depositOrders } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { formatCents } from "@/lib/amount";
import OrderStatusPoller from "@/components/OrderStatusPoller";

export const dynamic = "force-dynamic";

const STATUS_VIEW: Record<string, { label: string; tone: string; body: string }> = {
  waiting: {
    label: "Waiting for payment",
    tone: "bg-blue-50 text-blue-800 ring-blue-200",
    body: "Send the exact amount to the payment details on the NOWPayments checkout. This page updates as the payment is detected.",
  },
  confirming: {
    label: "Payment detected — confirming on-chain",
    tone: "bg-blue-50 text-blue-800 ring-blue-200",
    body: "Your payment is being confirmed on the blockchain. No action needed.",
  },
  confirmed: {
    label: "Payment confirmed",
    tone: "bg-blue-50 text-blue-800 ring-blue-200",
    body: "The network has confirmed your payment. Funding completes automatically.",
  },
  finished: {
    label: "Deposit complete",
    tone: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    body: "Funds are in your wallet — you can print checks right away.",
  },
  failed: {
    label: "Payment failed",
    tone: "bg-rose-50 text-rose-800 ring-rose-200",
    body: "The payment did not complete. Start a new deposit from the wallet page.",
  },
  expired: {
    label: "Payment expired",
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    body: "The checkout window expired before payment. Start a new deposit from the wallet page.",
  },
  refunded: {
    label: "Payment refunded",
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    body: "This payment was refunded by the operator.",
  },
  underpaid: {
    label: "Underpaid — needs review",
    tone: "bg-amber-50 text-amber-900 ring-amber-200",
    body: "Less crypto arrived than quoted. An operator will review the payment and credit your wallet manually if appropriate.",
  },
};

export default async function DepositStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const [order] = await db
    .select()
    .from(depositOrders)
    .where(and(eq(depositOrders.id, id), eq(depositOrders.userId, user.id)))
    .limit(1);
  if (!order) notFound();

  const view = STATUS_VIEW[order.status] ?? STATUS_VIEW.waiting;
  const live = !order.processedAt && !["failed", "expired", "cancelled"].includes(order.status);

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{view.label}</h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${view.tone}`}
          >
            {order.status}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{view.body}</p>

        <dl className="mt-5 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Deposit amount</dt>
            <dd className="font-semibold tabular-nums">{formatCents(order.priceUsdCents)}</dd>
          </div>
          {order.payCurrency ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Currency</dt>
              <dd className="font-mono text-xs">{order.payCurrency}</dd>
            </div>
          ) : null}
          {order.payAmount ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Quoted</dt>
              <dd className="font-mono text-xs">{order.payAmount}</dd>
            </div>
          ) : null}
          {order.actuallyPaid ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Paid</dt>
              <dd className="font-mono text-xs">{order.actuallyPaid}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Order</dt>
            <dd className="font-mono text-xs">{order.id}</dd>
          </div>
        </dl>

        {live ? <OrderStatusPoller orderId={order.id} /> : null}

        <div className="mt-5">
          <Link
            href="/wallet"
            className="rounded-full bg-[#0071e3] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
          >
            Back to wallet
          </Link>
        </div>
      </div>
    </div>
  );
}
