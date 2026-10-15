import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "echeckpay_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Single-operator credentials app. The password comes from AUTH_PASSWORD and
 * the cookie is an HMAC-signed expiry — no session store needed. If AUTH_PASSWORD
 * is unset we fall back to a development default and say so on the login screen.
 */
export const FALLBACK_PASSWORD = "echeckpay-dev";
const FALLBACK_SECRET = "echeckpay-development-secret-not-for-production";

function password(): string {
  return process.env.AUTH_PASSWORD?.trim() || FALLBACK_PASSWORD;
}

function usingFallbackPassword(): boolean {
  return !process.env.AUTH_PASSWORD?.trim();
}

function secret(): string {
  return process.env.AUTH_SECRET?.trim() || `${password()}::${FALLBACK_SECRET}`;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verifyPassword(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(password());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makeSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const payload = `${exp}|${nonce}`;
  return `${payload}|${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, mac] = parts;
  const payload = `${expRaw}|${nonce}`;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(expRaw);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function createSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, makeSessionToken(), {
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

export const loginIsFallback = usingFallbackPassword;

/** API guard: returns a 401 response when unauthenticated, otherwise null. */
export async function requireApiAuth(): Promise<NextResponse | null> {
  if (await isAuthed()) return null;
  return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
}
