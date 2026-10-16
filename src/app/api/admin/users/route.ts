import { NextResponse } from "next/server";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { checks, users } from "@/db/schema";
import { requireApiAdmin } from "@/lib/auth";
import { adminAdjustBalance } from "@/lib/wallet";
import { createAdminResetLink } from "@/lib/tokens";
import { logEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

/** User directory with counts — admin only. */
export async function GET() {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      emailVerified: users.emailVerified,
      balanceCents: users.balanceCents,
      createdAt: users.createdAt,
      checkCount: sql<number>`(select count(*)::int from ${checks} where ${checks.userId} = ${users.id})`,
    })
    .from(users)
    .where(ne(users.status, "deleted"))
    .orderBy(desc(users.id))
    .limit(200);
  return NextResponse.json({ users: rows });
}

type ActionBody = {
  action?: "block" | "unblock" | "delete" | "reset_link" | "adjust";
  userId?: number;
  amountCents?: number;
  memo?: string;
};

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;
  const admin = auth.user;

  const body = (await request.json().catch(() => ({}))) as ActionBody;
  const action = body.action;
  const targetId = Math.trunc(Number(body.userId));
  if (!action || !Number.isFinite(targetId) || targetId <= 0) {
    return NextResponse.json({ errors: ["action and userId are required."] }, { status: 400 });
  }
  if (targetId === admin.id && action !== "reset_link") {
    return NextResponse.json({ errors: ["Admins cannot act on their own account here."] }, { status: 400 });
  }
  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) return NextResponse.json({ errors: ["User not found."] }, { status: 404 });

  switch (action) {
    case "block":
    case "unblock": {
      if (target.role === "admin") {
        return NextResponse.json({ errors: ["Admin accounts cannot be blocked."] }, { status: 400 });
      }
      await db
        .update(users)
        .set({ status: action === "block" ? "blocked" : "active" })
        .where(eq(users.id, targetId));
      await logEvent(admin.id, null, action === "block" ? "user-blocked" : "user-unblocked", `user ${target.email} ${action}ed by admin`, "admin");
      return NextResponse.json({ ok: true, status: action === "block" ? "blocked" : "active" });
    }
    case "delete": {
      if (target.role === "admin") {
        return NextResponse.json({ errors: ["Admin accounts cannot be deleted."] }, { status: 400 });
      }
      await db.update(users).set({ status: "deleted" }).where(eq(users.id, targetId));
      await logEvent(admin.id, null, "user-deleted", `user ${target.email} deleted (soft) by admin`, "admin");
      return NextResponse.json({ ok: true });
    }
    case "reset_link": {
      // manual password reset — link handed to the user out-of-band
      const link = await createAdminResetLink(targetId);
      await logEvent(admin.id, null, "password-reset-issued", `admin issued reset link for ${target.email}`, "admin");
      return NextResponse.json({ ok: true, link });
    }
    case "adjust": {
      const amountCents = Math.trunc(Number(body.amountCents));
      const memo = String(body.memo ?? "").trim();
      if (!Number.isFinite(amountCents) || amountCents === 0) {
        return NextResponse.json({ errors: ["amountCents must be a non-zero integer."] }, { status: 400 });
      }
      const result = await adminAdjustBalance(targetId, amountCents, memo || `manual adjust by ${admin.email}`);
      if (!result.ok) return NextResponse.json({ errors: [result.error] }, { status: 400 });
      await logEvent(admin.id, null, "balance-adjusted", `${target.email}: ${amountCents >= 0 ? "+" : ""}${amountCents / 100} — ${memo}`, "admin");
      return NextResponse.json({ ok: true, balanceAfterCents: result.balanceAfterCents });
    }
    default:
      return NextResponse.json({ errors: ["Unknown action."] }, { status: 400 });
  }
}
