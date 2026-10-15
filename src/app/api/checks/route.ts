import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bankAccounts, checks } from "@/db/schema";
import { createCheck, listChecks, logEvent } from "@/lib/data";
import { getLayout } from "@/lib/layouts";
import { FEATURE_IDS, ALL_STATUSES, evaluateCompliance } from "@/lib/security";
import { requireApiAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  const rows = await listChecks();
  return NextResponse.json({ checks: rows });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Record<string, unknown>;
  const accountId = Number(body.accountId);
  if (!accountId) return NextResponse.json({ errors: ["Select a bank account."] }, { status: 400 });

  const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, accountId)).limit(1);
  if (!account) return NextResponse.json({ errors: ["Unknown account."] }, { status: 400 });

  const amountCents = Math.round(Number(body.amountCents ?? 0));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ errors: ["Enter an amount greater than zero."] }, { status: 400 });
  }
  const payeeName = str(body.payeeName).trim();
  if (payeeName.length < 2) {
    return NextResponse.json({ errors: ["Name the payee on the face of the check."] }, { status: 400 });
  }
  const dateIssued = str(body.dateIssued) || new Date().toISOString().slice(0, 10);
  if (Number.isNaN(new Date(`${dateIssued}T12:00:00`).getTime())) {
    return NextResponse.json({ errors: ["Enter a valid issue date."] }, { status: 400 });
  }

  const layout = getLayout(str(body.layout, "wallet"));
  const layoutId = layout.id;

  const features = Array.isArray(body.features)
    ? (body.features as unknown[]).filter((f): f is string => typeof f === "string" && FEATURE_IDS.includes(f))
    : [];

  const signatureMode = ["none", "facsimile", "image"].includes(str(body.signatureMode))
    ? str(body.signatureMode)
    : "facsimile";

  const status = ALL_STATUSES.includes(str(body.status) as never) ? str(body.status) : "draft";

  // --- server-side bank-acceptance gate (mirrors the writer UI) ------------
  const compliance = evaluateCompliance({
    routingNumber: account.routingNumber,
    accountNumber: account.accountNumber,
    checkNumber: String(Number(body.checkNumber) || account.nextCheckNumber),
    amountCents,
    dateIssued,
    payeeName,
    layout: layoutId,
    features,
    signatureMode,
    onUsFormat: account.onUsFormat as never,
    includeAmountField: Boolean(body.includeAmountField),
  });
  if (compliance.blockers > 0) {
    const blocking = compliance.checks.filter((c) => c.status === "fail").map((c) => c.label);
    return NextResponse.json(
      { errors: ["Bank-acceptance check failed:", ...blocking] },
      { status: 422 },
    );
  }
  if (/^(cash|bearer)$/i.test(payeeName)) {
    return NextResponse.json(
      { errors: ["A negotiable instrument cannot be payable to cash or bearer."] },
      { status: 400 },
    );
  }

  const result = await createCheck({
    accountId,
    payeeId: Number(body.payeeId) || null,
    checkNumber: Number(body.checkNumber) || null,
    payeeName,
    payeeAddress: str(body.payeeAddress),
    amountCents,
    dateIssued,
    memo: str(body.memo),
    layout: layoutId,
    status,
    features,
    signatureMode,
    includeAmountField: Boolean(body.includeAmountField),
    background: str(body.background, account.background) || account.background,
  });

  if (!result.ok) {
    return NextResponse.json({ errors: [result.error] }, { status: 409 });
  }

  if (result.check.status !== "draft") {
    await logEvent(result.check.id, result.check.status, `Saved directly as ${result.check.status}`);
  }
  return NextResponse.json({ check: result.check }, { status: 201 });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });

  const [row] = await db.select().from(checks).where(eq(checks.id, id)).limit(1);
  if (!row) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });
  if (row.status !== "draft") {
    return NextResponse.json(
      {
        errors: [
          `Only drafts can be deleted. Check #${row.checkNumber} is ${row.status} — use Void (with a reason) so the audit trail and the serial record stay intact.`,
        ],
      },
      { status: 409 },
    );
  }

  // keep the audit row: log BEFORE delete; the FK now preserves events
  await logEvent(
    null,
    "check-deleted",
    `Draft #${row.checkNumber} for ${row.payeeName} deleted (${row.amountCents} cents)`,
  );
  await db.delete(checks).where(eq(checks.id, id));
  return NextResponse.json({ ok: true });
}
