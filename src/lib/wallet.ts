import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  bankAccounts,
  checks,
  depositOrders,
  paymentEvents,
  printTokens,
  users,
  walletLedger,
} from "@/db/schema";

export const PRINT_PRICE_CENTS = 1000; // $10 per printed check (reprints included)
export const MIN_DEPOSIT_CENTS = 5000; // $50 minimum deposit
export const MAX_DEPOSIT_CENTS = 100_000_00; // $100,000 safety ceiling

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Count of deposit orders the user opened recently — anti invoice-spam. */
export async function recentDepositCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(depositOrders)
    .where(
      and(
        eq(depositOrders.userId, userId),
        sql`${depositOrders.createdAt} > now() - interval '15 minutes'`,
      ),
    );
  return row?.n ?? 0;
}

export async function createDepositOrder(userId: number, amountCents: number): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(depositOrders).values({
    id,
    userId,
    priceUsdCents: amountCents,
    status: "waiting",
  });
  return id;
}

export async function getDepositOrderForUser(userId: number, orderId: string) {
  const rows = await db
    .select()
    .from(depositOrders)
    .where(and(eq(depositOrders.id, orderId), eq(depositOrders.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function attachInvoice(orderId: string, invoiceId: string, payCurrency: string): Promise<void> {
  await db
    .update(depositOrders)
    .set({ invoiceId, payCurrency, updatedAt: new Date() })
    .where(eq(depositOrders.id, orderId));
}

export async function markOrderFailed(orderId: string, reason: string): Promise<void> {
  await db
    .update(depositOrders)
    .set({ status: "failed", failureReason: reason.slice(0, 300), updatedAt: new Date() })
    .where(eq(depositOrders.id, orderId));
}

export type IpnUpdate = {
  orderId: string;
  paymentId: string;
  status: string;
  payCurrency?: string;
  payAmount?: string;
  actuallyPaid?: string;
  failureReason?: string;
};

/**
 * Idempotent order update + one-time wallet credit. The ledger insert has a
 * unique business reference (`dep:<orderId>`), so repeated webhooks can never
 * double-credit; the whole read-modify-write runs inside one transaction and
 * the user row is locked FOR UPDATE to serialise balance changes.
 */
export async function processOrderUpdate(update: IpnUpdate): Promise<{ credited: boolean; status: string }> {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(depositOrders)
      .where(eq(depositOrders.id, update.orderId))
      .for("update")
      .limit(1);
    if (!order) throw new Error("unknown order");

    const [updated] = await tx
      .update(depositOrders)
      .set({
        paymentId: update.paymentId,
        status: update.status,
        payCurrency: update.payCurrency ?? order.payCurrency,
        payAmount: update.payAmount ?? order.payAmount,
        actuallyPaid: update.actuallyPaid ?? order.actuallyPaid,
        failureReason: update.failureReason ?? order.failureReason,
        updatedAt: new Date(),
      })
      .where(eq(depositOrders.id, order.id))
      .returning({ processedAt: depositOrders.processedAt, status: depositOrders.status, priceUsdCents: depositOrders.priceUsdCents });
    const currentStatus = updated.status;

    if (["failed", "expired", "refunded"].includes(currentStatus)) {
      await tx
        .update(depositOrders)
        .set({ processedAt: updated.processedAt ?? new Date() })
        .where(eq(depositOrders.id, order.id));
      return { credited: false, status: currentStatus };
    }

    // Credit only NOWPayments-terminal 'finished' — and only once.
    if (currentStatus !== "finished") {
      return { credited: false, status: currentStatus };
    }
    if (updated.processedAt) {
      return { credited: false, status: currentStatus }; // already credited
    }

    // Verify the crypto actually paid covers the invoice (tolerate 1% network
    // rounding); underpayments are flagged for manual review, not auto-credited.
    const paidNum = Number(update.actuallyPaid ?? "0");
    const expectedUsd = updated.priceUsdCents / 100;
    if (Number.isFinite(paidNum) && paidNum > 0 && paidNum < expectedUsd * 0.99) {
      await tx
        .update(depositOrders)
        .set({ status: "underpaid", processedAt: new Date(), updatedAt: new Date() })
        .where(eq(depositOrders.id, order.id));
      return { credited: false, status: "underpaid" };
    }

    // Lock the user's wallet row, append the ledger entry, bump the balance.
    const [user] = await tx
      .select({ balanceCents: users.balanceCents })
      .from(users)
      .where(eq(users.id, order.userId))
      .for("update")
      .limit(1);
    if (!user) throw new Error("user missing");

    const balanceAfter = user.balanceCents + updated.priceUsdCents;
    await tx
      .insert(walletLedger)
      .values({
        userId: order.userId,
        amountCents: updated.priceUsdCents,
        kind: "deposit",
        reference: `dep:${order.id}`,
        balanceAfterCents: balanceAfter,
        memo: "Crypto deposit (NOWPayments)",
      });
    await tx
      .update(users)
      .set({ balanceCents: balanceAfter })
      .where(eq(users.id, order.userId));
    await tx
      .update(depositOrders)
      .set({ processedAt: new Date() })
      .where(eq(depositOrders.id, order.id));
    return { credited: true, status: currentStatus };
  });
  return result;
}

/** Record an IPN/reconciliation event — unique on (paymentId, status). */
export async function recordPaymentEvent(
  paymentId: string,
  orderId: string,
  status: string,
  payload: Record<string, unknown>,
  note = "",
): Promise<boolean> {
  try {
    await db.insert(paymentEvents).values({ paymentId, orderId, status, payload, note });
    return true;
  } catch {
    return false; // duplicate — already recorded
  }
}

export type ChargeResult =
  | {
      ok: true;
      already: boolean;
      balanceAfterCents: number;
      printedAt: Date;
      printCount: number;
      checkStatus: string;
    }
  | { ok: false; error: string; code: "unknown_check" | "insufficient_funds" | "blocked" };

/**
 * Charge $10 for a print (or reprint) of a check and mark it printed. The
 * ledger reference doubles as the idempotency key, so a double-clicked print
 * button charges exactly once. Everything happens inside one transaction with
 * the wallet row locked FOR UPDATE.
 */
export async function chargeForPrint(
  userId: number,
  checkId: number,
  chargeKey: string,
): Promise<ChargeResult> {
  try {
    const result = await db.transaction(async (tx) => {
      const [check] = await tx
        .select()
        .from(checks)
        .where(and(eq(checks.id, checkId), eq(checks.userId, userId)))
        .for("update")
        .limit(1);
      if (!check) throw Object.assign(new Error("unknown check"), { code: "unknown_check" });

      const [user] = await tx
        .select({ balanceCents: users.balanceCents, status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .for("update")
        .limit(1);
      if (!user || user.status === "blocked") throw Object.assign(new Error("account blocked"), { code: "blocked" });

      const existing = await tx
        .select()
        .from(walletLedger)
        .where(eq(walletLedger.reference, chargeKey))
        .limit(1);
      if (existing.length) {
        // idempotent replay of the same print click
        const printedAt = check.printedAt ?? new Date();
        return {
          ok: true as const,
          already: true,
          balanceAfterCents: user.balanceCents,
          printedAt,
          printCount: check.printCount,
          checkStatus: check.status,
        };
      }

      if (user.balanceCents < PRINT_PRICE_CENTS) {
        throw Object.assign(new Error("insufficient funds"), { code: "insufficient_funds" });
      }

      const balanceAfter = user.balanceCents - PRINT_PRICE_CENTS;
      await tx.insert(walletLedger).values({
        userId,
        amountCents: -PRINT_PRICE_CENTS,
        kind: "print_charge",
        reference: chargeKey,
        balanceAfterCents: balanceAfter,
        memo: `Print check #${check.checkNumber}`,
      });
      await tx.update(users).set({ balanceCents: balanceAfter }).where(eq(users.id, userId));

      const now = new Date();
      const newStatus = ["draft", "printed"].includes(check.status) ? "printed" : check.status;
      await tx
        .update(checks)
        .set({ printCount: check.printCount + 1, printedAt: now, status: newStatus })
        .where(eq(checks.id, check.id));

      await tx.insert(auditEvents).values({
        userId,
        checkId: check.id,
        action: "printed",
        detail: `#${check.checkNumber} → ${check.payeeName} — ${fmtMoney(PRINT_PRICE_CENTS)} print charge`,
        actor: "print engine",
      });

      return {
        ok: true as const,
        already: false,
        balanceAfterCents: balanceAfter,
        printedAt: now,
        printCount: check.printCount + 1,
        checkStatus: newStatus,
      };
    });
    return result;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    const message = (err as Error)?.message ?? "";
    if (code === "unknown_check" || /unknown check/.test(message)) {
      return { ok: false, error: "Check not found.", code: "unknown_check" };
    }
    if (code === "insufficient_funds" || /insufficient funds/.test(message)) {
      return {
        ok: false,
        error: `Balance too low — printing costs ${fmtMoney(PRINT_PRICE_CENTS)}. Add funds to continue.`,
        code: "insufficient_funds",
      };
    }
    if (code === "blocked" || /account blocked/.test(message)) {
      return { ok: false, error: "Account is blocked — contact support.", code: "blocked" };
    }
    return { ok: false, error: "Could not process the print charge.", code: "unknown_check" };
  }
}

/** Admin manual balance adjustment — always audited through the ledger. */
export async function adminAdjustBalance(
  targetUserId: number,
  amountCents: number,
  memo: string,
): Promise<{ ok: true; balanceAfterCents: number } | { ok: false; error: string }> {
  try {
    const balanceAfter = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ balanceCents: users.balanceCents })
        .from(users)
        .where(eq(users.id, targetUserId))
        .for("update")
        .limit(1);
      if (!user) throw new Error("user not found");
      const next = user.balanceCents + amountCents;
      if (next < 0) throw new Error("adjustment would overdraw the balance");
      await tx.insert(walletLedger).values({
        userId: targetUserId,
        amountCents,
        kind: "admin_adjust",
        reference: `adj:${targetUserId}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`,
        balanceAfterCents: next,
        memo: memo.slice(0, 300),
      });
      await tx.update(users).set({ balanceCents: next }).where(eq(users.id, targetUserId));
      return next;
    });
    return { ok: true, balanceAfterCents: balanceAfter };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? "adjustment failed") };
  }
}

export async function listLedger(userId: number, limit = 50) {
  return db
    .select()
    .from(walletLedger)
    .where(eq(walletLedger.userId, userId))
    .orderBy(sql`${walletLedger.id} desc`)
    .limit(limit);
}

/** Issue the one-time token that unlocks the clean (un-watermarked) print view. */
export async function issuePrintToken(userId: number, checkId: number, tokenHash: string): Promise<void> {
  await db.insert(printTokens).values({ userId, checkId, tokenHash });
}

export async function consumePrintToken(tokenHash: string, userId: number, checkId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(printTokens)
    .where(and(eq(printTokens.tokenHash, tokenHash), isNull(printTokens.usedAt)))
    .limit(1);
  const row = rows[0];
  if (!row || row.userId !== userId || row.checkId !== checkId) return false;
  const updated = await db
    .update(printTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(printTokens.id, row.id), isNull(printTokens.usedAt)))
    .returning({ id: printTokens.id });
  return updated.length > 0;
}

export async function getOwnedCheckAccount(userId: number, checkId: number) {
  const rows = await db
    .select({ check: checks, account: bankAccounts })
    .from(checks)
    .innerJoin(bankAccounts, eq(checks.accountId, bankAccounts.id))
    .where(and(eq(checks.id, checkId), eq(checks.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
