import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bankAccounts, checks } from "@/db/schema";
import { requireApiAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "printed", "issued", "cleared", "void", "stopped"];

/** CSV export of the full register (all statuses, Newline-safe cell encoding). */
export async function GET(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const accountId = Number(url.searchParams.get("accountId")) || 0;
  const status = url.searchParams.get("status") ?? "";

  const rows = await db
    .select({
      checkNumber: checks.checkNumber,
      payeeName: checks.payeeName,
      amountCents: checks.amountCents,
      dateIssued: checks.dateIssued,
      status: checks.status,
      memo: checks.memo,
      layout: checks.layout,
      accountLabel: bankAccounts.label,
      accountNumber: bankAccounts.accountNumber,
      routingNumber: bankAccounts.routingNumber,
    })
    .from(checks)
    .innerJoin(bankAccounts, eq(checks.accountId, bankAccounts.id))
    .where(
      accountId && STATUSES.includes(status)
        ? eq(checks.accountId, accountId)
        : accountId
          ? eq(checks.accountId, accountId)
          : undefined,
    );

  const cell = (v: string | number) => {
    const s = String(v).replace(/[\r\n\t]+/g, " ").trim();
    return /^[=+\-@\t]/.test(s) ? `'${s}` : s;
  };

  const header = "SERIAL,ACCOUNT,ROUTING,PAYEE,AMOUNT,ISSUE_DATE,MEMO,LAYOUT,STATUS";
  const lines = rows.map((r) =>
    [
      String(r.checkNumber).padStart(6, "0"),
      cell(r.accountLabel),
      cell(r.routingNumber),
      cell(r.payeeName),
      (r.amountCents / 100).toFixed(2),
      r.dateIssued,
      cell(r.memo),
      r.layout,
      r.status.toUpperCase(),
    ].join(","),
  );

  const csv = [header, ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="check-register-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
