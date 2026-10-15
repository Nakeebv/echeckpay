import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, bankAccounts, checks, payees } from "@/db/schema";
import { BASELINE_FEATURES } from "@/lib/security";

let seeded = false;
let seedPromise: Promise<void> | null = null;

/** Retry connection-level failures (serverless pools drop idle sockets). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const cause = (error as { cause?: unknown })?.cause as Error | undefined;
      const msg = String(cause?.message ?? (error as Error)?.message ?? error);
      lastError = error;
      if (
        !/connection terminated|Connection terminated|ECONNRESET|ECONNREFUSED|EPIPE|write after end|socket hang up|headache timeout|CONNECT_TIMEOUT|timeout expired/i.test(
          msg,
        )
      ) {
        throw error;
      }
      // each retry builds a fresh connection
      await new Promise((r) => setTimeout(r, attempt === 0 ? 300 : 900));
    }
  }
  throw lastError;
}

/**
 * Idempotent demo seed so a fresh database is immediately usable. Guarded by a
 * shared in-process promise *and* a Postgres advisory lock, because server
 * components fire several parallel queries on first render.
 */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  if (!seedPromise) {
    seedPromise = runSeed().catch(() => {
      // table may not exist yet during first bootstrap
      seeded = false;
    });
  }
  await seedPromise;
}

async function runSeed(): Promise<void> {
  await withRetry(() => db.transaction(async (tx) => {
    // Non-blocking: if another isolate is seeding, skip rather than block —
    // a blocking advisory lock stalls every page until the lock resolves.
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(778811223) as ok`);
    const rows = (lock as unknown as { rows?: { ok?: boolean }[] }).rows ?? [];
    if (rows[0]?.ok !== true) {
      return;
    }
    const existing = await tx.select({ n: sql<number>`count(*)::int` }).from(bankAccounts);
    if ((existing[0]?.n ?? 0) > 0) {
      return;
    }
    await seedAll(tx);
  }));
  seeded = true;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function seedAll(db: Tx): Promise<void> {
  const inserted = await db
    .insert(bankAccounts)
      .values([
        {
          label: "Northwind Studio LLC — Operating",
          accountClass: "business",
          holderName: "Northwind Studio LLC",
          holderAddress: "1188 Harborview Ave, Suite 400\nSeattle, WA 98101",
          holderPhone: "(206) 555-0142",
          bankName: "Cascade Trust Bank, N.A.",
          bankAddress: "PO Box 3587\nSeattle, WA 98124",
          routingNumber: "125000024",
          accountNumber: "000123456789",
          fraction: "12-5000/1250",
          onUsFormat: "account-symbol",
          nextCheckNumber: 4501,
          background: "biz-guilloche-navy",
          signatureText: "M. Alvarez",
          signatureTitle: "Authorized Signature — Treasurer",
        },
        {
          label: "Jordan Ellis — Household",
          accountClass: "personal",
          holderName: "Jordan Ellis",
          holderAddress: "72 Rowan Street\nPortland, OR 97209",
          holderPhone: "(503) 555-0198",
          bankName: "Columbia Community Credit Union",
          bankAddress: "1201 SW Jefferson St\nPortland, OR 97205",
          routingNumber: "323172705",
          accountNumber: "9876543210",
          fraction: "32-3172/3231",
          onUsFormat: "account-symbol-serial",
          nextCheckNumber: 1201,
          background: "per-linen",
          signatureText: "Jordan Ellis",
          signatureTitle: "Authorized Signature",
        },
      ])
      .returning({ id: bankAccounts.id });

    const payeeRows = await db
      .insert(payees)
      .values([
        { name: "Willamette Print & Bindery", address: "410 SE Water Ave\nPortland, OR 97214", isBusiness: true, defaultMemo: "Invoice" },
        { name: "City of Portland — Water Bureau", address: "1120 SW 5th Ave\nPortland, OR 97204", isBusiness: true, defaultMemo: "Utility account" },
        { name: "Dr. Amara Osei, DDS", address: "3300 NE Broadway\nPortland, OR 97232", defaultMemo: "Dental" },
        { name: "Sunrise Property Group LLC", address: "88 NW Davis St\nPortland, OR 97209", isBusiness: true, defaultMemo: "Rent — Unit 4B" },
        { name: "Puget Sound Logistics", address: "2200 6th Ave S\nSeattle, WA 98134", isBusiness: true, defaultMemo: "Freight charges" },
      ])
      .returning({ id: payees.id, name: payees.name });

    const biz = inserted[0].id;
    const per = inserted[1].id;
    const pid = (n: string) => payeeRows.find((p) => p.name === n)?.id ?? null;
    const today = new Date();
    const iso = (offsetDays: number) => {
      const d = new Date(today.getTime() + offsetDays * 86_400_000);
      return d.toISOString().slice(0, 10);
    };

    const rows = [
      {
        accountId: biz,
        payeeId: pid("Puget Sound Logistics"),
        checkNumber: 4501,
        payeeName: "Puget Sound Logistics",
        amountCents: 128450,
        dateIssued: iso(-6),
        memo: "Freight — Q1 inbound",
        layout: "voucher",
        status: "issued",
        background: "biz-guilloche-navy",
        features: [...BASELINE_FEATURES, "chem_reactive", "thermochromic", "uv_fibers", "erasure_guard", "positive_pay", "audit_trail"],
        signatureMode: "facsimile",
      },
      {
        accountId: biz,
        payeeId: pid("Sunrise Property Group LLC"),
        checkNumber: 4502,
        payeeName: "Sunrise Property Group LLC",
        amountCents: 245000,
        dateIssued: iso(-3),
        memo: "Office rent — March",
        layout: "voucher",
        status: "printed",
        background: "biz-guilloche-forest",
        features: [...BASELINE_FEATURES, "chem_reactive", "uv_fibers", "erasure_guard", "positive_pay", "audit_trail"],
        signatureMode: "facsimile",
      },
      {
        accountId: per,
        payeeId: pid("Willamette Print & Bindery"),
        checkNumber: 1201,
        payeeName: "Willamette Print & Bindery",
        amountCents: 8760,
        dateIssued: iso(-1),
        memo: "Stationery reorder",
        layout: "wallet3",
        status: "issued",
        background: "per-linen",
        features: [...BASELINE_FEATURES, "chem_reactive", "uv_fibers", "audit_trail"],
        signatureMode: "facsimile",
      },
      {
        accountId: per,
        payeeId: pid("Dr. Amara Osei, DDS"),
        checkNumber: 1202,
        payeeName: "Dr. Amara Osei, DDS",
        amountCents: 34200,
        dateIssued: iso(0),
        memo: "Cleaning + exam",
        layout: "wallet3",
        status: "draft",
        background: "plain",
        features: [...BASELINE_FEATURES, "chem_reactive", "uv_fibers", "audit_trail"],
        signatureMode: "facsimile",
      },
    ];

    const created = await db.insert(checks).values(rows).returning({ id: checks.id });
    await db.insert(auditEvents).values(
      created.map((c, i) => ({
        checkId: c.id,
        action: "created",
        detail: `Draft ${rows[i].checkNumber} for ${rows[i].payeeName}`,
      })),
    );
}

export function toAccountView<T extends {
  holderName: string;
  holderAddress: string;
  holderPhone: string;
  bankName: string;
  bankAddress: string;
  routingNumber: string;
  accountNumber: string;
  fraction: string;
  onUsFormat: string;
  logoDataUrl: string | null;
  bankLogoWidthIn: number;
  companyLogoDataUrl: string | null;
  companyLogoWidthIn: number;
  signatureDataUrl: string | null;
  signatureText: string;
  signatureTitle: string;
  accountClass: string;
  background: string;
  micrRenderer: string;
  micrFontDataUrl: string | null;
  micrFontSizePt: number;
}>(a: T) {
  return {
    holderName: a.holderName,
    holderAddress: a.holderAddress,
    holderPhone: a.holderPhone,
    bankName: a.bankName,
    bankAddress: a.bankAddress,
    routingNumber: a.routingNumber,
    accountNumber: a.accountNumber,
    // strictly manual — only a stored fraction is ever printed, never derived
    fraction: a.fraction,
    onUsFormat: a.onUsFormat,
    logoDataUrl: a.logoDataUrl,
    bankLogoWidthIn: a.bankLogoWidthIn,
    companyLogoDataUrl: a.companyLogoDataUrl,
    companyLogoWidthIn: a.companyLogoWidthIn,
    signatureDataUrl: a.signatureDataUrl,
    signatureText: a.signatureText,
    signatureTitle: a.signatureTitle,
    accountClass: a.accountClass,
    background: a.background,
    micrRenderer: a.micrRenderer,
    micrFontDataUrl: a.micrFontDataUrl,
    micrFontSizePt: a.micrFontSizePt,
  };
}

export async function listAccounts() {
  await ensureSeeded();
  return withRetry(() => db.select().from(bankAccounts).orderBy(bankAccounts.id));
}

export async function listPayees() {
  await ensureSeeded();
  return withRetry(() => db.select().from(payees).orderBy(payees.name));
}

export type RegisterRow = {
  id: number;
  checkNumber: number;
  payeeName: string;
  amountCents: number;
  dateIssued: string;
  status: string;
  memo: string;
  layout: string;
  accountId: number;
  accountLabel: string;
  accountNumber: string;
  routingNumber: string;
  printedAt: Date | null;
};

export async function listChecks(limit = 200, offset = 0): Promise<RegisterRow[]> {
  await ensureSeeded();
  const rows = await withRetry(() => db
    .select({
      id: checks.id,
      checkNumber: checks.checkNumber,
      payeeName: checks.payeeName,
      amountCents: checks.amountCents,
      dateIssued: checks.dateIssued,
      status: checks.status,
      memo: checks.memo,
      layout: checks.layout,
      accountId: checks.accountId,
      accountLabel: bankAccounts.label,
      accountNumber: bankAccounts.accountNumber,
      routingNumber: bankAccounts.routingNumber,
      printedAt: checks.printedAt,
    })
    .from(checks)
    .innerJoin(bankAccounts, eq(checks.accountId, bankAccounts.id))
    .orderBy(desc(checks.checkNumber), desc(checks.id))
    .limit(limit)
    .offset(offset));
  return rows;
}

export async function countChecks(): Promise<number> {
  await ensureSeeded();
  const [row] = await withRetry(() => db.select({ n: sql<number>`count(*)::int` }).from(checks));
  return row?.n ?? 0;
}

export async function listAuditsForCheck(id: number) {
  return withRetry(() =>
    db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.checkId, id))
      .orderBy(desc(auditEvents.id)),
  );
}

/** Global audit feed (incl. account/payee/positive-pay events with no check). */
export async function listRecentAudits(limit = 12) {
  await ensureSeeded();
  return withRetry(() =>
    db.select().from(auditEvents).orderBy(desc(auditEvents.id)).limit(limit),
  );
}

export async function getCheckDetail(id: number) {
  await ensureSeeded();
  const rows = await withRetry(() =>
    db
      .select({ check: checks, account: bankAccounts, payee: payees })
      .from(checks)
      .innerJoin(bankAccounts, eq(checks.accountId, bankAccounts.id))
      .leftJoin(payees, eq(checks.payeeId, payees.id))
      .where(eq(checks.id, id))
      .limit(1),
  );
  if (!rows.length) return null;
  const audit = await listAuditsForCheck(id);
  return { ...rows[0], audit };
}

export async function serialExists(accountId: number, checkNumber: number, exceptId?: number) {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(checks)
    .where(
      and(
        eq(checks.accountId, accountId),
        eq(checks.checkNumber, checkNumber),
        exceptId ? sql`${checks.id} <> ${exceptId}` : sql`true`,
      ),
    );
  return (rows[0]?.n ?? 0) > 0;
}

export type CreateCheckInput = {
  accountId: number;
  payeeId: number | null;
  checkNumber?: number | null;
  payeeName: string;
  payeeAddress?: string;
  amountCents: number;
  dateIssued: string;
  memo: string;
  layout: string;
  status?: string;
  features: string[];
  signatureMode: string;
  includeAmountField: boolean;
  background: string;
};

export type CreateCheckResult =
  | { ok: true; check: typeof checks.$inferSelect }
  | { ok: false; error: string };

/**
 * Allocate a serial and create the check in ONE transaction. The account row is
 * locked FOR UPDATE so two concurrent writers cannot mint the same serial, and
 * the unique index is the backstop that turns any residual race into a clean
 * error instead of a duplicate instrument.
 */
export async function createCheck(input: CreateCheckInput): Promise<CreateCheckResult> {
  await ensureSeeded();
  try {
    const created = await db.transaction(async (tx) => {
      const [account] = await tx
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, input.accountId))
        .for("update")
        .limit(1);
      if (!account) throw new Error("Unknown account");

      let checkNumber = input.checkNumber ?? null;
      if (!checkNumber || checkNumber <= 0) {
        const [maxRow] = await tx
          .select({ max: sql<number>`coalesce(max(${checks.checkNumber}), 0)::int` })
          .from(checks)
          .where(eq(checks.accountId, input.accountId));
        checkNumber = Math.max(account.nextCheckNumber, (maxRow?.max ?? 0) + 1);
      }

      const [dupe] = await tx
        .select({ id: checks.id })
        .from(checks)
        .where(and(eq(checks.accountId, input.accountId), eq(checks.checkNumber, checkNumber)))
        .limit(1);
      if (dupe) {
        throw new Error(
          `Check number ${checkNumber} is already used on this account — serials must be gapless and unique.`,
        );
      }

      const [row] = await tx
        .insert(checks)
        .values({
          accountId: input.accountId,
          payeeId: input.payeeId,
          checkNumber,
          payeeName: input.payeeName,
          payeeAddress: input.payeeAddress ?? "",
          amountCents: input.amountCents,
          dateIssued: input.dateIssued,
          memo: input.memo,
          layout: input.layout,
          status: input.status ?? "draft",
          features: input.features,
          signatureMode: input.signatureMode,
          includeAmountField: input.includeAmountField,
          background: input.background,
        })
        .returning();

      await tx
        .update(bankAccounts)
        .set({ nextCheckNumber: Math.max(account.nextCheckNumber, checkNumber + 1) })
        .where(eq(bankAccounts.id, input.accountId));

      await tx.insert(auditEvents).values({
        checkId: row.id,
        action: "created",
        detail: `#${checkNumber} → ${input.payeeName} (${input.layout})`,
      });
      return row;
    });
    return { ok: true, check: created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the check.";
    if (/duplicate key|unique/i.test(message) || /already used/.test(message)) {
      return {
        ok: false,
        error:
          "That serial is already used on this account — serials must be gapless and unique. Pick the next free number.",
      };
    }
    if (message === "Unknown account") return { ok: false, error: "Unknown account." };
    return { ok: false, error: "Could not save the check." };
  }
}

export async function getStats() {
  await ensureSeeded();
  const [accountCount] = await withRetry(() =>
    db.select({ n: sql<number>`count(*)::int` }).from(bankAccounts),
  );
  const [payeeCount] = await withRetry(() =>
    db.select({ n: sql<number>`count(*)::int` }).from(payees),
  );
  const [totals] = await withRetry(() =>
    db
    .select({
      n: sql<number>`count(*)::int`,
      outstanding: sql<number>`coalesce(sum(case when status in ('draft','printed','issued') then amount_cents else 0 end), 0)::int`,
      cleared: sql<number>`coalesce(sum(case when status = 'cleared' then amount_cents else 0 end), 0)::int`,
      voided: sql<number>`count(*) filter (where status in ('void','stopped'))::int`,
    })
    .from(checks),
  );
  return {
    accounts: accountCount?.n ?? 0,
    payees: payeeCount?.n ?? 0,
    checks: totals?.n ?? 0,
    outstandingCents: totals?.outstanding ?? 0,
    clearedCents: totals?.cleared ?? 0,
    voided: totals?.voided ?? 0,
  };
}

export async function logEvent(
  checkId: number | null,
  action: string,
  detail = "",
  actor = "owner",
): Promise<void> {
  await db.insert(auditEvents).values({ checkId, action, detail, actor });
}
