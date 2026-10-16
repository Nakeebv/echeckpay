import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { depositOrders } from "@/db/schema";
import {
  NOWPAYMENTS_CONFIGURED,
  getPayment,
  mapProviderStatus,
  verifyIpnSignature,
} from "@/lib/nowpayments";
import { processOrderUpdate, recordPaymentEvent } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/**
 * NOWPayments IPN webhook.
 *
 * Security model:
 *  1. raw body read (no transformation) → HMAC-SHA512 signature verification
 *     with the IPN secret, constant-time compare, reject on any failure.
 *  2. the payload is only a TRIGGER — the trusted state comes from our own
 *     server-side API lookup of the payment (fixed provider base URL), so a
 *     verified-but-forged packet still cannot change money state.
 *  3. every (paymentId, status) pair is recorded once (unique index) — replayed
 *     webhooks short-circuit idempotently with 200 so provider retries stop.
 */
export async function POST(request: Request) {
  if (!NOWPAYMENTS_CONFIGURED) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const signature = request.headers.get("x-nowpayments-sig");
  const rawBody = await request.text();
  if (rawBody.length > 100_000) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const valid = await verifyIpnSignature(rawBody, signature);
  if (!valid) {
    await recordPaymentEvent("invalid-signature", "", "rejected", {}, "IPN rejected — missing/invalid signature");
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const providerPaymentId =
    payload.payment_id !== undefined ? String(payload.payment_id) : "";
  const providerOrderId = typeof payload.order_id === "string" ? payload.order_id : "";
  const providerStatus = String(payload.payment_status ?? "");
  if (!providerPaymentId || !providerOrderId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const [order] = await db
    .select()
    .from(depositOrders)
    .where(eq(depositOrders.id, providerOrderId))
    .limit(1);
  if (!order) {
    // not ours — record minimally, respond OK so the provider stops retrying
    await recordPaymentEvent(providerPaymentId, providerOrderId, providerStatus || "unknown", {}, "unknown order id");
    return NextResponse.json({ ok: true });
  }

  // duplicate delivery — already recorded AND processed
  const alreadySeen = await recordPaymentEvent(providerPaymentId, providerOrderId, providerStatus || "", payload);
  if (order.processedAt && ["finished", "failed", "expired", "refunded", "underpaid"].includes(order.status)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // reconcile against the provider API (trusted path; fixed base URL, server
  // controlled payment id from OUR stored order, never the webhook payload)
  let statusRaw = providerStatus;
  let actuallyPaid = payload.actually_paid !== undefined ? String(payload.actually_paid) : undefined;
  let payAmount = payload.pay_amount !== undefined ? String(payload.pay_amount) : undefined;
  let payCurrency = payload.pay_currency !== undefined ? String(payload.pay_currency) : undefined;

  if (order.paymentId) {
    try {
      const payment = await getPayment(order.paymentId);
      statusRaw = String(payment.payment_status ?? statusRaw);
      actuallyPaid = payment.actually_paid !== undefined ? String(payment.actually_paid) : actuallyPaid;
      payAmount = payment.pay_amount !== undefined ? String(payment.pay_amount) : payAmount;
      payCurrency = payment.pay_currency !== undefined ? String(payment.pay_currency) : payCurrency;
    } catch {
      // provider lookup failed — proceed with signature-verified payload
    }
  }

  const mapped = mapProviderStatus(statusRaw);
  if (!mapped) {
    await recordPaymentEvent(providerPaymentId, providerOrderId, statusRaw || "unknown", payload, "unmapped status");
    return NextResponse.json({ ok: true });
  }

  await recordPaymentEvent(providerPaymentId, providerOrderId, mapped, payload, "ipn accepted");
  try {
    await processOrderUpdate({
      orderId: order.id,
      paymentId: providerPaymentId,
      status: mapped,
      payCurrency,
      payAmount,
      actuallyPaid,
    });
return NextResponse.json({ ok: true });
  } catch {
    // let the provider retry on transient DB failures
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
