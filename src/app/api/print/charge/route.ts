import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { PRINT_PRICE_CENTS, chargeForPrint, issuePrintToken } from "@/lib/wallet";
import { sha256Hex } from "@/lib/auth";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Charge $10 for one print/reprint of a check and issue the one-time token
 * that unlocks the clean (un-watermarked) print view. Idempotent per charge
 * key; blocked at insufficient balance.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: { checkId?: number; chargeKey?: string };
  try {
    body = (await request.json()) as { checkId?: number; chargeKey?: string };
  } catch {
    return NextResponse.json({ errors: ["Invalid request body."] }, { status: 400 });
  }
  const checkId = Math.trunc(Number(body.checkId));
  if (!Number.isFinite(checkId) || checkId <= 0) {
    return NextResponse.json({ errors: ["checkId is required."] }, { status: 400 });
  }
  const chargeKey = typeof body.chargeKey === "string" ? body.chargeKey.slice(0, 64) : "";
  if (!chargeKey || chargeKey.length < 16) {
    return NextResponse.json({ errors: ["chargeKey is required."] }, { status: 400 });
  }

  const result = await chargeForPrint(auth.user.id, checkId, chargeKey);
  if (!result.ok) {
    const code = result.code === "insufficient_funds" ? 402 : result.code === "blocked" ? 403 : 404;
    return NextResponse.json(
      { errors: [result.error], code: result.code, priceCents: PRINT_PRICE_CENTS },
      { status: code },
    );
  }

  // one-time print pass — the clean sheet can be rendered exactly once
  const token = randomBytes(24).toString("base64url");
  await issuePrintToken(auth.user.id, checkId, sha256Hex(token));

  return NextResponse.json({
    ok: true,
    printUrl: `/checks/${checkId}/print?pt=${token}`,
    already: result.already,
    balanceAfterCents: result.balanceAfterCents,
  });
}
