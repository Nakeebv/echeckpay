import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens } from "@/db/schema";
import { newOpaqueToken, tokenHash } from "@/lib/auth";
import { appBaseUrl, resetEmailHtml, sendEmail, verifyEmailHtml } from "@/lib/email";

export type TokenPurpose = "verify_email" | "reset_password" | "setup_password";

async function insertToken(userId: number, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const token = newOpaqueToken();
  await db.insert(authTokens).values({
    userId,
    tokenHash: tokenHash(token),
    purpose,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/** Short-lived token for the post-verification password setup step. */
export async function createSetupToken(userId: number): Promise<string> {
  return insertToken(userId, "setup_password", 30 * 60 * 1000);
}

/** Create + email a verification link. Returns the raw link when undelivered. */
export async function sendVerificationEmail(
  userId: number,
  email: string,
): Promise<{ sent: boolean; link?: string }> {
  const token = await insertToken(userId, "verify_email", 48 * 60 * 60 * 1000);
  const link = `${appBaseUrl()}/verify?token=${token}`;
  const result = await sendEmail(email, "Confirm your eCheckPay email", verifyEmailHtml(link));
  return result.sent ? { sent: true } : { sent: false, link };
}

/** Create + email a password-reset link. Returns raw link when undelivered. */
export async function sendPasswordResetEmail(
  userId: number,
  email: string,
): Promise<{ sent: boolean; link?: string }> {
  const token = await insertToken(userId, "reset_password", 60 * 60 * 1000);
  const link = `${appBaseUrl()}/reset?token=${token}`;
  const result = await sendEmail(email, "Reset your eCheckPay password", resetEmailHtml(link));
  return result.sent ? { sent: true } : { sent: false, link };
}

/** Admin-issued reset link (for users who lost email access) — never emailed. */
export async function createAdminResetLink(userId: number): Promise<string> {
  const token = await insertToken(userId, "reset_password", 60 * 60 * 1000);
  return `${appBaseUrl()}/reset?token=${token}`;
}

/**
 * Atomically consume a token of the given purpose; returns the userId or null.
 * The UPDATE-guard on used_at/expiry makes single-use safe under concurrency.
 */
export async function consumeToken(
  rawToken: string,
  purpose: TokenPurpose,
): Promise<number | null> {
  const rows = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash(rawToken)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const updated = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.id, row.id), isNull(authTokens.usedAt)))
    .returning({ id: authTokens.id });
  return updated.length ? row.userId : null;
}
