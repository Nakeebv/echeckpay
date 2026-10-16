import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { depositOrders } from "@/db/schema";
import { appBaseUrl } from "@/lib/email";
import {
  MAX_DEPOSIT_CENTS,
  MIN_DEPOSIT_CENTS,
  attachInvoice,
  createDepositOrder,
  markOrderFailed,
  recentDepositCount,
} from "@/lib/wallet";
import { NOWPAYMENTS_CONFIGURED, createInvoice } from "@/lib/nowpayments";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Create a crypto deposit order. Server-side pricing only — the amount comes
 * from the authenticated intent, never a client-sent total.
 * Rate limit: max 5 order creations per user per 15 minutes (anti spam).
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;



  let body: { amountCents?: number };
  try {
    body = (await request.json()) as { amountCents?: number };
  } catch {
    return NextResponse.json({ errors: ["Invalid request body."] }, { status: 400 });
  }

  // strict integer math — never floats for money
  if (!NOWPAYMENTS_CONFIGURED) {
    return NextResponse.json(
      { errors: ["Deposits are temporarily unavailable — payment provider not configured."], code: "provider_unconfigured" },
      { status: 503 },
    );
  }
  const amountCents = Math.trunc(Number(body.amountCents));
  if (!Number.isFinite(amountCents) || amountCents < MIN_DEPOSIT_CENTS) {
    return NextResponse.json(
      { errors: [`Minimum deposit is $${MIN_DEPOSIT_CENTS / 100}.`], code: "min_amount" },
      { status: 400 },
    );
  }
  if (amountCents > MAX_DEPOSIT_CENTS) {
    return NextResponse.json({ errors: ["Deposit amount is too large."], code: "max_amount" }, { status: 400 });
  }

  const recent = await recentDepositCount(user.id);
  if (recent >= 5) {
    return NextResponse.json(
      { errors: ["Too many deposit attempts — try again in a few minutes."], code: "rate_limited" },
      { status: 429 },
    );
  }

  const orderId = await createDepositOrder(user.id, amountCents);
  const base = appBaseUrl();

  try {
    const invoice = await createInvoice({
      orderId,
      priceUsdCents: amountCents,
      description: `eCheckPay wallet deposit (${orderId.slice(0, 8)})`,
      ipnCallbackUrl: `${base}/api/nowpayments/ipn`,
      successUrl: `${base}/wallet/${orderId}?state=returning`,
      cancelUrl: `${base}/wallet?state=cancelled`,
    });
    await attachInvoice(orderId, invoice.id, "");
    return NextResponse.json({ ok: true, orderId, invoiceUrl: invoice.invoice_url }, { status: 201 });
  } catch (error) {
    await markOrderFailed(orderId, String((error as Error)?.message ?? "invoice creation failed").slice(0, 300));
    return NextResponse.json(
      { errors: ["Could not start the payment — try again shortly."], code: "provider_error" },
      { status: 502 },
    );
  }
}

/** List the signed-in user's recent orders (wallet history views). */
export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const rows = await db
    .select()
    .from(depositOrders)
    .where(eq(depositOrders.userId, auth.user.id))
    .limit(25);
  return NextResponse.json({ orders: rows });
}
