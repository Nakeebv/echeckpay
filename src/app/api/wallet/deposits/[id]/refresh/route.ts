import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { depositOrders } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { NOWPAYMENTS_CONFIGURED, getPayment, mapProviderStatus } from "@/lib/nowpayments";
import { processOrderUpdate, recordPaymentEvent } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/**
 * Reconciliation endpoint: the OWNER (or admin) can refresh an order's state
 * from the provider API server-side. This never trusts any client-supplied
 * status — everything comes from NOWPayments' own response.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const [order] = await db
    .select()
    .from(depositOrders)
    .where(and(eq(depositOrders.id, id), eq(depositOrders.userId, auth.user.id)))
    .limit(1);
  if (!order) return NextResponse.json({ errors: ["Not found."] }, { status: 404 });

  if (!NOWPAYMENTS_CONFIGURED) {
    return NextResponse.json({ order }, { status: 200 });
  }

  // finished orders are final — never walk them back
  if (order.processedAt) {
    return NextResponse.json({ order });
  }

  if (!order.paymentId) {
    // invoice not converted to a payment yet — still waiting
    return NextResponse.json({ order });
  }

  try {
    const payment = await getPayment(order.paymentId);
    const mapped = mapProviderStatus(String(payment.payment_status ?? ""));
    if (!mapped) {
      await recordPaymentEvent(String(payment.payment_id), order.id, String(payment.payment_status), payment, "unmapped provider status — ignored");
      return NextResponse.json({ order });
    }
    await recordPaymentEvent(String(payment.payment_id), order.id, mapped, payment, "provider refresh");
    if (mapped !== order.status || !order.processedAt) {
      await processOrderUpdate({
        orderId: order.id,
        paymentId: String(payment.payment_id),
        status: mapped,
        payCurrency: payment.pay_currency ? String(payment.pay_currency) : undefined,
        payAmount: payment.pay_amount !== undefined ? String(payment.pay_amount) : undefined,
        actuallyPaid: payment.actually_paid !== undefined ? String(payment.actually_paid) : undefined,
      });
    }
    const [fresh] = await db
      .select()
      .from(depositOrders)
      .where(eq(depositOrders.id, order.id))
      .limit(1);
    return NextResponse.json({ order: fresh });
  } catch (error) {
    return NextResponse.json(
      { order, errors: [`Provider lookup failed: ${String((error as Error)?.message ?? "").slice(0, 120)}`] },
      { status: 502 },
    );
  }
}
