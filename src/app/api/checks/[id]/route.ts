import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bankAccounts, checks } from "@/db/schema";
import { logEvent } from "@/lib/data";
import {
  ALL_STATUSES,
  FEATURE_IDS,
  STATUS_TRANSITIONS,
  evaluateCompliance,
} from "@/lib/security";
import { requireApiAuth } from "@/lib/auth";
import { getLayout, type LayoutId } from "@/lib/layouts";

export const dynamic = "force-dynamic";

const TRANSITION_DETAILS: Record<string, string> = {
  printed: "Marked printed — add the record to the Positive Pay issue file",
  issued: "Marked issued / delivered to payee",
  cleared: "Marked cleared by the drawee bank",
  void: "Voided — serial retired, item is not negotiable",
  stopped: "Stop-payment placed with the drawee bank",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });

  const [current] = await db.select().from(checks).where(eq(checks.id, id)).limit(1);
  if (!current) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  let transitionDetail = "";

  if (typeof body.status === "string") {
    const next = body.status;
    if (!ALL_STATUSES.includes(next as never)) {
      return NextResponse.json({ errors: ["Unknown status."] }, { status: 400 });
    }
    if (next !== current.status && !(STATUS_TRANSITIONS[current.status] ?? []).includes(next)) {
      return NextResponse.json(
        {
          errors: [
            `Cannot move a ${current.status} check to ${next}. Allowed: ${
              (STATUS_TRANSITIONS[current.status] ?? ["—"]).join(", ") || "no further transitions"
            }.`,
          ],
        },
        { status: 409 },
      );
    }
    if ((next === "void" || next === "stopped") && !String(body.statusReason ?? "").trim()) {
      return NextResponse.json(
        { errors: ["A void or stop-payment requires a reason for the audit trail."] },
        { status: 400 },
      );
    }
    patch.status = next;
    if (next === "printed") patch.printedAt = new Date();
    const reason = String(body.statusReason ?? "").trim();
    if (reason) patch.statusReason = reason;
    transitionDetail = TRANSITION_DETAILS[next] ?? `Marked ${next}`;
    if (reason) transitionDetail += ` — reason: ${reason}`;
  }

  // content edits are only allowed while the check is still a draft
  const contentKeys = ["memo", "payeeName", "payeeAddress", "dateIssued"] as const;
  const wantsContentEdit = contentKeys.some((k) => typeof body[k] === "string") || body.amountCents !== undefined || Array.isArray(body.features);
  if (wantsContentEdit) {
    if (current.status !== "draft") {
      return NextResponse.json(
        { errors: [`Only draft checks can be edited — #${current.checkNumber} is ${current.status}. Void it and write a new check instead.`] },
        { status: 409 },
      );
    }
    for (const key of contentKeys) {
      if (typeof body[key] === "string") patch[key] = body[key];
    }
    if (body.amountCents !== undefined) {
      const amount = Math.round(Number(body.amountCents));
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ errors: ["Amount must be greater than zero."] }, { status: 400 });
      }
      patch.amountCents = amount;
    }
    if (Array.isArray(body.features)) {
      patch.features = (body.features as unknown[]).filter(
        (f): f is string => typeof f === "string" && FEATURE_IDS.includes(f),
      );
    }
    if (typeof body.layout === "string" && patch.status === undefined) {
      const layout = getLayout(body.layout);
      patch.layout = layout.id;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ errors: ["Nothing to update"] }, { status: 400 });
  }

  // if this transition is a print/issue, re-run the compliance gate server-side
  if (patch.status === "printed" || patch.status === "issued") {
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, current.accountId))
      .limit(1);
    const amount = Number(patch.amountCents ?? current.amountCents);
    const dateIssued = String(patch.dateIssued ?? current.dateIssued);
    const payeeName = String(patch.payeeName ?? current.payeeName);
    const features = (patch.features as string[] | undefined) ?? current.features ?? [];
    if (account) {
      const compliance = evaluateCompliance({
        routingNumber: account.routingNumber,
        accountNumber: account.accountNumber,
        checkNumber: String(current.checkNumber),
        amountCents: amount,
        dateIssued,
        payeeName,
        layout: getLayout(current.layout).id as LayoutId,
        features,
        signatureMode: current.signatureMode,
        onUsFormat: account.onUsFormat as never,
        includeAmountField: current.includeAmountField,
      });
      if (compliance.blockers > 0) {
        const blocking = compliance.checks.filter((c) => c.status === "fail").map((c) => c.label);
        return NextResponse.json(
          { errors: ["Bank-acceptance check failed — fix before printing:", ...blocking] },
          { status: 422 },
        );
      }
    }
  }

  const [row] = await db.update(checks).set(patch).where(eq(checks.id, id)).returning();
  if (!row) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });

  if (typeof body.status === "string" && body.status !== current.status) {
    await logEvent(id, body.status, transitionDetail);
  } else if (wantsContentEdit) {
    await logEvent(id, "updated", "Draft details edited");
  }
  return NextResponse.json({ check: row });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });

  const [row] = await db.select().from(checks).where(eq(checks.id, id)).limit(1);
  if (!row) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });
  if (row.status !== "draft") {
    return NextResponse.json(
      {
        errors: [
          `Only drafts can be deleted. #${row.checkNumber} is ${row.status} — void it instead so the audit trail and serial record stay intact.`,
        ],
      },
      { status: 409 },
    );
  }
  await logEvent(
    null,
    "check-deleted",
    `Draft #${row.checkNumber} for ${row.payeeName} deleted (${row.amountCents} cents)`,
  );
  await db.delete(checks).where(eq(checks.id, id));
  return NextResponse.json({ ok: true });
}
