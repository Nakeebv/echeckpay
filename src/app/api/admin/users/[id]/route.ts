import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, bankAccounts, checks, depositOrders, supportThreads, users, walletLedger } from "@/db/schema";
import { requireApiAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Full 360° view of a user — admin only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  const userId = Math.trunc(Number((await params).id));
  if (!Number.isFinite(userId)) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });

  const passwordHash = user.passwordHash;
  void passwordHash; // never leaves the server

  const [userChecks, orders, ledger, threads, audits, accountCount] = await Promise.all([
    db.select().from(checks).where(eq(checks.userId, userId)).orderBy(desc(checks.id)).limit(50),
    db.select().from(depositOrders).where(eq(depositOrders.userId, userId)).orderBy(desc(depositOrders.createdAt)).limit(25),
    db.select().from(walletLedger).where(eq(walletLedger.userId, userId)).orderBy(desc(walletLedger.id)).limit(25),
    db.select().from(supportThreads).where(eq(supportThreads.userId, userId)).orderBy(desc(supportThreads.updatedAt)).limit(20),
    db.select().from(auditEvents).where(eq(auditEvents.userId, userId)).orderBy(desc(auditEvents.id)).limit(25),
    db.select({ n: sql<number>`count(*)::int` }).from(bankAccounts).where(eq(bankAccounts.userId, userId)),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      balanceCents: user.balanceCents,
      createdAt: user.createdAt,
    },
    accounts: accountCount[0]?.n ?? 0,
    checks: userChecks,
    orders,
    ledger,
    threads,
    audits,
  });
}
