import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { User } from "@/db/schema";

export const SESSION_COOKIE = "echeckpay_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/* ------------------------------------------------------------------ */
/* secrets                                                             */
/* ------------------------------------------------------------------ */

function authSecret(): string {
  return process.env.AUTH_SECRET?.trim() || "echeckpay-development-secret-not-for-production";
}

function hmac(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/* ------------------------------------------------------------------ */
/* passwords — PBKDF2-HMAC-SHA256 via WebCrypto (works on Workers)     */
/* ------------------------------------------------------------------ */

const PBKDF2_ITERATIONS = 60_000;

function toB64(buf: ArrayBuffer | Uint8Array): string {
  return Buffer.from(new Uint8Array(buf)).toString("base64");
}

function fromB64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromB64(parts[2]);
  const expected = parts[3];
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );
  return safeEqual(toB64(bits), expected);
}

/* password policy: ≥10 chars, letters + digits + a symbol */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (!/[a-zA-Z]/.test(password)) return "Include at least one letter.";
  if (!/[0-9]/.test(password)) return "Include at least one number.";
  if (!/[^a-zA-Z0-9]/.test(password)) return "Include at least one symbol.";
  return null;
}

/* ------------------------------------------------------------------ */
/* sessions — signed, user-scoped                                      */
/* ------------------------------------------------------------------ */

export function makeSessionToken(userId: number): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${userId}|${exp}|${nonce}`;
  return `${payload}|${hmac(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): number | null {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 4) return null;
  const [userIdRaw, expRaw, nonce, mac] = parts;
  const payload = `${userIdRaw}|${expRaw}|${nonce}`;
  if (!safeEqual(hmac(payload), mac)) return null;
  const userId = Number(userIdRaw);
  const exp = Number(expRaw);
  if (!Number.isFinite(userId) || !Number.isFinite(exp) || exp <= Date.now()) return null;
  return userId;
}

export async function createSession(userId: number): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/* ------------------------------------------------------------------ */
/* current user helpers                                                */
/* ------------------------------------------------------------------ */

export async function isAuthed(): Promise<boolean> {
  return (await currentUser()) !== null;
}

/**
 * Short-lived per-isolate cache. The layout resolves the user, then each page
 * resolves it again — this collapses repeated lookups into one DB read every
 * couple of seconds instead of one per render.
 */
const USER_CACHE_TTL_MS = 3_000;
const userCache = new Map<number, { user: User | null; expiresAt: number }>();

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const userId = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (userId === null) return null;

  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0] ?? null;
  const active = user && user.status === "active" ? user : null;

  userCache.set(userId, { user: active, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  if (userCache.size > 500) {
    for (const [k, v] of userCache) if (v.expiresAt <= Date.now()) userCache.delete(k);
  }
  return active;
}

export async function currentUserByToken(token: string | undefined | null): Promise<User | null> {
  const userId = verifySessionToken(token);
  if (userId === null) return null;
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user || user.status !== "active") return null;
  return user;
}

/** API guard: returns a 401 response when unauthenticated, otherwise the user. */
export async function requireApiUser(): Promise<{ user: User } | { error: NextResponse }> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const userId = verifySessionToken(token);
  if (userId === null) {
    return { error: NextResponse.json({ errors: ["Sign in required."] }, { status: 401 }) };
  }
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user || user.status !== "active") {
    return { error: NextResponse.json({ errors: ["Account unavailable."] }, { status: 403 }) };
  }
  return { user };
}

/** Admin API guard. */
export async function requireApiAdmin(): Promise<{ user: User } | { error: NextResponse }> {
  const result = await requireApiUser();
  if ("error" in result) return result;
  if (result.user.role !== "admin") {
    return { error: NextResponse.json({ errors: ["Admin access required."] }, { status: 403 }) };
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* one-time tokens (email verification / password reset / print pass)  */
/* ------------------------------------------------------------------ */

export function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return sha256Hex(token);
}
