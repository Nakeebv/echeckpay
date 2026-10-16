import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bankAccounts, checks } from "@/db/schema";
import { logEvent } from "@/lib/data";
import { formatPlain } from "@/lib/amount";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Positive Pay issue file. Every drawee bank that offers the service accepts a
 * fixed-width or CSV issue record: account, serial, amount, payee, issue date.
 * Transmitting this file is what makes a counterfeit against your account
 * actually get returned.
 */

/** Statuses that may appear in an issue file. Void/stopped/draft never export. */
const PP_STATUSES = ["issued", "printed", "cleared"] as const;

/** Neutralise CSV/formula injection (=, +, -, @, tab, CR) in bank files. */
function csvCell(value: string): string {
  let v = value.replace(/[\r\n\t]+/g, " ").trim();
  if (/^[=+\-@\u0009]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, "'")}"`;
}

const rowSelection = {
  id: checks.id,
  checkNumber: checks.checkNumber,
  amountCents: checks.amountCents,
  payeeName: checks.payeeName,
  dateIssued: checks.dateIssued,
  status: checks.status,
  accountNumber: bankAccounts.accountNumber,
  routingNumber: bankAccounts.routingNumber,
  accountLabel: bankAccounts.label,
};

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const accountId = Number(url.searchParams.get("accountId"));

  // statuses are whitelisted — a raw status list from the query string can no
  // longer pull void/stopped/draft items into the bank file
  const statusParam = url.searchParams.get("status");
  const statusFilter: string[] = statusParam
    ? statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => (PP_STATUSES as readonly string[]).includes(s))
    : ["issued", "printed"];

  const conditions = [
    eq(checks.userId, auth.user.id),
    ...(statusFilter.length ? [inArray(checks.status, statusFilter)] : []),
    ...(accountId ? [eq(checks.accountId, accountId)] : []),
  ];

  const rows = await db
    .select(rowSelection)
    .from(checks)
    .innerJoin(bankAccounts, eq(checks.accountId, bankAccounts.id))
    .where(conditions.length ? and(...conditions) : undefined);

  if (rows.length) {
    await logEvent(auth.user.id, null, "positive-pay-export", `${rows.length} issue record(s) exported`);
  }

  const header = "BANK_ACCOUNT,ROUTING,CHECK_NUMBER,AMOUNT,PAYEE,ISSUE_DATE,STATUS";
  const lines = rows.map((r) =>
    [
      csvCell(r.accountNumber),
      csvCell(r.routingNumber),
      String(r.checkNumber).padStart(6, "0"),
      formatPlain(r.amountCents),
      csvCell(r.payeeName),
      r.dateIssued,
      r.status.toUpperCase(),
    ].join(","),
  );

  const csv = [header, ...lines].join("\r\n");
  const name = `positive-pay-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const body = (await request.json()) as { ids?: number[] };
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ ok: true, updated: 0, skipped: 0 });

  // Only drafts and printed items may move to issued. Void / stopped / cleared
  // records can never be re-activated through the Positive Pay path.
  const rows = await db.select().from(checks).where(and(inArray(checks.id, ids), eq(checks.userId, user.id)));
  const updatable = rows.filter((r) => r.status === "draft" || r.status === "printed");

  if (updatable.length) {
    await db
      .update(checks)
      .set({ status: "issued" })
      .where(inArray(checks.id, updatable.map((r) => r.id)));
    await logEvent(
      user.id,
      null,
      "positive-pay-issue",
      `${updatable.length} record(s) transmitted to the drawee bank`,
    );
  }
  return NextResponse.json({
    ok: true,
    updated: updatable.length,
    skipped: rows.length - updatable.length,
  });
}
