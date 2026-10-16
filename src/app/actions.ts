"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/data";
import {
  consumeToken,
  createSetupToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* login                                                               */
/* ------------------------------------------------------------------ */

export async function loginAction(formData: FormData): Promise<void> {
  await ensureSeeded();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  if (!verifyAuthPayload(email, password)) {
    redirect("/login?error=1");
  }
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=1");
  }
  if (user.status === "blocked") {
    redirect("/login?blocked=1");
  }
  if (user.status === "deleted") {
    redirect("/login?error=1");
  }
  await createSession(user.id);
  redirect(next.startsWith("/") ? next : user.role === "admin" ? "/admin" : "/dashboard");
}

function verifyAuthPayload(email: string, password: string): boolean {
  return EMAIL_RE.test(email) && password.length > 0;
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

/* ------------------------------------------------------------------ */
/* registration: email → verification token → password setup           */
/* ------------------------------------------------------------------ */

export async function registerAction(formData: FormData): Promise<void> {
  await ensureSeeded();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    redirect("/register?error=invalid_email");
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    redirect("/register?error=email_taken");
  }
  // unguessable placeholder hash — the account has no usable password until
  // the setup step after email verification
  const placeholder = await hashPassword(crypto.randomUUID());
  const [created] = await db
    .insert(users)
    .values({ email, passwordHash: placeholder, role: "user", status: "active", emailVerified: 0 })
    .returning({ id: users.id });

  const result = await sendVerificationEmail(created.id, email);
  if (result.sent) {
    redirect(`/register/sent?email=${encodeURIComponent(email)}`);
  }
  // dev fallback (no email provider configured): show the verification link
  // directly to the freshly-registered user — it is their own link.
  redirect(`/register/sent?email=${encodeURIComponent(email)}&link=${encodeURIComponent(result.link ?? "")}`);
}

export async function verifyEmailAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const userId = await consumeToken(token, "verify_email");
  if (userId === null) {
    redirect("/verify?state=invalid");
  }
  // issue the short-lived setup-password token
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) redirect("/verify?state=invalid");
  const setupToken = await createSetupToken(userId);
  redirect(`/setup-password?token=${setupToken}`);
}

export async function setupPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const saved = String(formData.get("saved") ?? "");

  if (saved !== "on") redirect(`/setup-password?token=${encodeURIComponent(token)}&error=not_saved`);
  if (password !== confirm) redirect(`/setup-password?token=${encodeURIComponent(token)}&error=mismatch`);
  const weakness = validatePasswordStrength(password);
  if (weakness) redirect(`/setup-password?token=${encodeURIComponent(token)}&error=weak&detail=${encodeURIComponent(weakness)}`);

  const userId = await consumeToken(token, "setup_password");
  if (userId === null) {
    redirect("/verify?state=invalid");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), emailVerified: 1 })
    .where(eq(users.id, userId));
  redirect("/login?registered=1");
}

/* ------------------------------------------------------------------ */
/* password recovery                                                   */
/* ------------------------------------------------------------------ */

export async function forgotAction(formData: FormData): Promise<void> {
  await ensureSeeded();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    redirect("/forgot?sent=1");
  }
  const [user] = await db
    .select({ id: users.id, email: users.email, emailVerified: users.emailVerified, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  // never reveal whether the account exists
  if (user && user.emailVerified === 1) {
    const result = await sendPasswordResetEmail(user.id, user.email);
    if (!result.sent && result.link && user.role === "admin") {
      // operator fallback when email isn't configured — admin link only
      redirect(`/forgot?sent=1&adminLink=${encodeURIComponent(result.link)}`);
    }
  }
  redirect("/forgot?sent=1");
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) redirect(`/reset?token=${encodeURIComponent(token)}&error=mismatch`);
  const weakness = validatePasswordStrength(password);
  if (weakness) redirect(`/reset?token=${encodeURIComponent(token)}&error=weak&detail=${encodeURIComponent(weakness)}`);
  const userId = await consumeToken(token, "reset_password");
  if (userId === null) {
    redirect("/reset?state=invalid");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, userId));
  redirect("/login?reset=1");
}
