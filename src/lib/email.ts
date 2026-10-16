/**
 * Transactional email. Uses Resend when RESEND_API_KEY is configured;
 * otherwise reports `sent: false` so flows can surface links in dev mode.
 * Never logs or returns secrets — only the caller-visible link itself.
 */
export type EmailResult = { sent: boolean; error?: string };

export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    (process.env.NODE_ENV === "production" ? "https://echeckpay.nakeebv.workers.dev" : "http://localhost:3000")
  );
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { sent: false, error: "Email delivery is not configured." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || "eCheckPay <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      return { sent: false, error: `Email provider error (${res.status}).` };
    }
    return { sent: true };
  } catch {
    return { sent: false, error: "Email provider unreachable." };
  }
}

export function verifyEmailHtml(link: string): string {
  return `
  <h2 style="font-family:sans-serif">Confirm your eCheckPay email</h2>
  <p style="font-family:sans-serif">Tap the button below to confirm this address. You only need this
  if you ever forget your password.</p>
  <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0071e3;color:#fff;border-radius:8px;font-family:sans-serif;text-decoration:none">Confirm email</a></p>
  <p style="font-family:sans-serif;color:#6b7280;font-size:12px">This link expires in 48 hours.</p>`;
}

export function resetEmailHtml(link: string): string {
  return `
  <h2 style="font-family:sans-serif">Reset your eCheckPay password</h2>
  <p style="font-family:sans-serif">Tap the button below to choose a new password.</p>
  <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0071e3;color:#fff;border-radius:8px;font-family:sans-serif;text-decoration:none">Reset password</a></p>
  <p style="font-family:sans-serif;color:#6b7280;font-size:12px">This link expires in 60 minutes and can be used once.</p>`;
}
