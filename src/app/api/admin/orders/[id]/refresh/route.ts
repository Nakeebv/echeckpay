import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { depositOrders } from "@/db/schema";
import { requireApiAdmin } from "@/lib/auth";
import { NOWPAYMENTS_CONFIGURED, getPayment, mapProviderStatus } from "@/lib/nowpayments";
import { processOrderUpdate, recordPaymentEvent } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/** Admin reconciliation: re-check any order against the provider. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const [order] = await db.select().from(depositOrders).where(eq(depositOrders.id, id)).limit(1);
  if (!order) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });

  if (order.processedAt) return NextResponse.json({ order });
  if (!NOWPAYMENTS_CONFIGURED) return NextResponse.json({ order }, { status: 503 });
  if (!order.paymentId) return NextResponse.json({ order });

  try {
    const payment = await getPayment(order.paymentId);
    const mapped = mapProviderStatus(String(payment.payment_status ?? ""));
    if (mapped) {
      if (mapped !== order.status || !order.processedAt) {
        await processOrderUpdate({
          orderId: order.id,
          paymentId: String(payment.payment_id),
          status: mapped,
          payCurrency: payment.pay_currency !== undefined ? String(payment.pay_currency) : undefined,
          payAmount: payment.pay_amount !== undefined ? String(payment.pay_amount) : undefined,
          actuallyPaid: payment.actually_paid !== undefined ? String(payment.actually_paid) : undefined,
        });
      }
    }
    const [fresh] = await db.select().from(depositOrders).where(eq(depositOrders.id, order.id)).limit(1);
    return NextResponse.json({ order: fresh });
  } catch (error) {
    return NextResponse.json(
      { errors: [String((error as Error)?.message ?? "provider lookup failed").slice(0, 150)] },
      { status: 502 },
    );
  }
}
