/**
 * NOWPayments client. Source of truth:
 * https://nowpayments.io/doc — invoice creation (hosted checkout), payment
 * status lookups and the IPN postback (HMAC-SHA512 over a sorted `key:value`
 * string joined with "|", signed with the IPN secret key).
 *
 * Credentials live in server-side env vars only:
 *   NOWPAYMENTS_API_KEY   — "x-api-key" header on every API call
 *   NOWPAYMENTS_IPN_SECRET— shared secret used to verify IPN signatures
 *   NOWPAYMENTS_API_BASE_URL — override for the sandbox
 */
const BASE_URL = process.env.NOWPAYMENTS_API_BASE_URL?.trim() || "https://api.nowpayments.io/v1";
const API_KEY = process.env.NOWPAYMENTS_API_KEY?.trim() || "";
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET?.trim() || "";

export const NOWPAYMENTS_CONFIGURED = Boolean(API_KEY);

function apiKey(): string {
  if (!API_KEY) throw new Error("NOWPayments is not configured (missing NOWPAYMENTS_API_KEY).");
  return API_KEY;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey(),
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`NOWPayments ${res.status}: ${bodyText.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export type NowPaymentsInvoice = {
  id: string;
  invoice_url: string;
};

/** Create a hosted-checkout invoice. `price_amount` is in USD units. */
export async function createInvoice(input: {
  orderId: string;
  priceUsdCents: number;
  description: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<NowPaymentsInvoice> {
  const result = await call<NowPaymentsInvoice>("/invoice", {
    method: "POST",
    body: JSON.stringify({
      price_amount: Number((input.priceUsdCents / 100).toFixed(2)),
      price_currency: "usd",
      order_id: input.orderId,
      order_description: input.description.slice(0, 120),
      ipn_callback_url: input.ipnCallbackUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
  });
  if (!result?.id || !result?.invoice_url) {
    throw new Error("NOWPayments returned an unexpected invoice response.");
  }
  return result;
}

export type NowPaymentsPayment = {
  payment_id: number | string;
  payment_status: string;
  actually_paid?: string | number;
  pay_amount?: string | number;
  pay_currency?: string;
  price_amount?: string | number;
  price_currency?: string;
  order_id?: string;
  outcome_amount?: string | number;
};

/** Server-side payment status lookup (trusted reconciliation path). */
export async function getPayment(paymentId: string): Promise<NowPaymentsPayment> {
  return call<NowPaymentsPayment>(`/payment/${encodeURIComponent(paymentId)}`);
}

/* ------------------------------------------------------------------ */
/* IPN signature                                                       */
/* ------------------------------------------------------------------ */

/**
 * Official algorithm: sort payload keys alphabetically, concatenate
 * `key:value` pairs with "|", HMAC-SHA512 with the IPN secret, hex digest.
 * Nested values are stringified the way JSON.stringify renders them.
 */
function canonicalIpnString(payload: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(payload).sort()) {
    const value = payload[key];
    sorted[key] = value !== null && typeof value === "object" && !(value instanceof Array)
      ? JSON.stringify(value)
      : value;
  }
  return Object.keys(sorted)
    .map((k) => {
      const v = sorted[k];
      return `${k}:${typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`;
    })
    .join("|");
}

async function hmacSha512Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify an IPN signature. NOWPayments has shipped a couple of canonicalisation
 * variants; the documented one is tried first, the plain-sorted-JSON form as a
 * fallback. Both require the shared secret, so neither weakens the check.
 */
export async function verifyIpnSignature(
  rawBody: string,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!signature || !IPN_SECRET) return false;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return false;
  }
  const computedPrimary = await hmacSha512Hex(canonicalIpnString(payload), IPN_SECRET);
  if (timingSafeHexEqual(computedPrimary, signature.toLowerCase())) return true;
  const sortedJson = JSON.stringify(
    Object.keys(payload)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => ((acc[k] = payload[k]), acc), {}),
  );
  const computedFallback = await hmacSha512Hex(sortedJson, IPN_SECRET);
  return timingSafeHexEqual(computedFallback, signature.toLowerCase());
}

/* ------------------------------------------------------------------ */
/* status mapping                                                      */
/* ------------------------------------------------------------------ */

const PROVIDER_STATUS_MAP: Record<string, string> = {
  waiting: "waiting",
  confirm: "confirming",
  confirming: "confirming",
  confirmed: "confirmed",
  sending: "confirmed",
  paid: "finished",
  finished: "finished",
  failed: "failed",
  expired: "expired",
  refunded: "refunded",
  partially_paid: "underpaid",
};

export const ORDER_TERMINAL_STATUSES = ["finished", "failed", "expired", "refunded", "underpaid"];

export function mapProviderStatus(raw: string): string | null {
  const key = raw?.toLowerCase().trim();
  return key ? (PROVIDER_STATUS_MAP[key] ?? null) : null;
}
