import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { bankAccounts, checks } from "@/db/schema";
import { listAccounts, logEvent } from "@/lib/data";
import { isRoutingValid } from "@/lib/micr";
import { sanitizeDataUrl } from "@/lib/datasafe";
import { requireApiAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Payload = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function int(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  const rows = await listAccounts();
  return NextResponse.json({ accounts: rows });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Payload;
  const routing = str(body.routingNumber).replace(/[^0-9]/g, "");
  const account = str(body.accountNumber).replace(/[^0-9 ]/g, "");

  const errors: string[] = [];
  if (!str(body.label).trim()) errors.push("Account label is required.");
  if (!str(body.holderName).trim()) errors.push("Account holder name is required.");
  if (routing.length !== 9) errors.push("Routing number must be exactly 9 digits.");
  else if (!isRoutingValid(routing)) errors.push("Routing number fails the ABA mod-10 check-digit test.");
  if (account.replace(/\s/g, "").length < 4) errors.push("Account number must be at least 4 digits.");
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const logo = sanitizeDataUrl(body.logoDataUrl, "image", 400_000);
  const signature = sanitizeDataUrl(body.signatureDataUrl, "image", 400_000);
  const companyLogo = sanitizeDataUrl(body.companyLogoDataUrl, "image", 400_000);
  const micrFont = sanitizeDataUrl(body.micrFontDataUrl, "font", 2_000_000);
  if (body.logoDataUrl && !logo) {
    return NextResponse.json({ errors: ["Bank logo must be a PNG/JPEG/WebP/SVG data URL ≤ 400 KB."] }, { status: 400 });
  }
  if (body.companyLogoDataUrl && !companyLogo) {
    return NextResponse.json({ errors: ["Company logo must be a PNG/JPEG/WebP/SVG data URL ≤ 400 KB."] }, { status: 400 });
  }
  if (body.signatureDataUrl && !signature) {
    return NextResponse.json({ errors: ["Signature must be a PNG/JPEG data URL ≤ 400 KB."] }, { status: 400 });
  }
  if (body.micrFontDataUrl && !micrFont) {
    return NextResponse.json({ errors: ["Font must be a TTF/OTF/WOFF/WOFF2 data URL ≤ 2 MB."] }, { status: 400 });
  }

  const [row] = await db
    .insert(bankAccounts)
    .values({
      label: str(body.label).trim(),
      accountClass: str(body.accountClass, "business") === "personal" ? "personal" : "business",
      holderName: str(body.holderName).trim(),
      holderAddress: str(body.holderAddress),
      holderPhone: str(body.holderPhone),
      bankName: str(body.bankName),
      bankAddress: str(body.bankAddress),
      routingNumber: routing,
      accountNumber: account.replace(/\s/g, ""),
      fraction: str(body.fraction).trim(),
      onUsFormat: str(body.onUsFormat, "account-symbol-serial"),
      nextCheckNumber: Math.max(1, int(body.nextCheckNumber, 1001)),
      logoDataUrl: logo,
      bankLogoWidthIn: Math.min(2.6, Math.max(0.4, Number(body.bankLogoWidthIn) || 1.5)),
      companyLogoDataUrl: companyLogo,
      companyLogoWidthIn: Math.min(2.6, Math.max(0.4, Number(body.companyLogoWidthIn) || 1.2)),
      signatureDataUrl: signature,
      signatureText: str(body.signatureText),
      signatureTitle: str(body.signatureTitle, "Authorized Signature") || "Authorized Signature",
      background: str(body.background, "sky") || "sky",
      micrRenderer: str(body.micrRenderer, "font") === "vector" ? "vector" : "font",
      micrFontDataUrl: micrFont,
      micrFontSizePt: Math.min(20, Math.max(6, Number(body.micrFontSizePt) || 12)),
    })
    .returning();

  await logEvent(null, "account-created", `Account "${row.label}" (${row.bankName || "drawee bank"}) added`);
  return NextResponse.json({ account: row }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Payload;
  const id = int(body.id, 0);
  if (!id) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });

  const [existing] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
  if (!existing) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });

  const patch: Record<string, unknown> = {};
  const textFields = [
    "label",
    "holderAddress",
    "holderPhone",
    "bankName",
    "bankAddress",
    "fraction",
    "signatureText",
    "signatureTitle",
    "background",
  ] as const;
  for (const key of textFields) {
    if (typeof body[key] === "string") patch[key] = body[key];
  }
  if (typeof body.holderName === "string") {
    if (!body.holderName.trim()) {
      return NextResponse.json({ errors: ["Account holder name is required."] }, { status: 400 });
    }
    patch.holderName = body.holderName.trim();
  }
  if (typeof body.label === "string" && !String(patch.label ?? "").trim()) {
    return NextResponse.json({ errors: ["Account label cannot be empty."] }, { status: 400 });
  }
  if (typeof body.accountClass === "string") {
    patch.accountClass = body.accountClass === "personal" ? "personal" : "business";
  }
  if (typeof body.onUsFormat === "string") {
    const formats = ["account-symbol-serial", "account-symbol", "symbol-account"];
    if (!formats.includes(body.onUsFormat)) {
      return NextResponse.json({ errors: ["Unknown On-Us format."] }, { status: 400 });
    }
    patch.onUsFormat = body.onUsFormat;
  }
  if (typeof body.micrRenderer === "string") {
    patch.micrRenderer = body.micrRenderer === "vector" ? "vector" : "font";
  }
  if (typeof body.routingNumber === "string") {
    const r = body.routingNumber.replace(/[^0-9]/g, "");
    if (r.length !== 9 || !isRoutingValid(r)) {
      return NextResponse.json({ errors: ["Routing number is invalid — 9 digits, ABA mod-10."] }, { status: 400 });
    }
    patch.routingNumber = r;
  }
  if (typeof body.accountNumber === "string") {
    const acct = body.accountNumber.replace(/[^0-9]/g, "");
    if (acct.length < 4) {
      return NextResponse.json({ errors: ["Account number must be at least 4 digits."] }, { status: 400 });
    }
    patch.accountNumber = acct;
  }
  if (body.nextCheckNumber !== undefined) {
    patch.nextCheckNumber = Math.max(1, int(body.nextCheckNumber, 1));
  }
  if ("logoDataUrl" in body) {
    if (body.logoDataUrl) {
      const clean = sanitizeDataUrl(body.logoDataUrl, "image", 400_000);
      if (!clean) {
        return NextResponse.json({ errors: ["Bank logo must be a PNG/JPEG/WebP/SVG data URL ≤ 400 KB."] }, { status: 400 });
      }
      patch.logoDataUrl = clean;
    } else {
      patch.logoDataUrl = null; // removal
    }
  }
  if (body.bankLogoWidthIn !== undefined) {
    const w = Number(body.bankLogoWidthIn);
    if (Number.isFinite(w)) patch.bankLogoWidthIn = Math.min(2.6, Math.max(0.4, w));
  }
  if ("companyLogoDataUrl" in body) {
    if (body.companyLogoDataUrl) {
      const clean = sanitizeDataUrl(body.companyLogoDataUrl, "image", 400_000);
      if (!clean) {
        return NextResponse.json({ errors: ["Company logo must be a PNG/JPEG/WebP/SVG data URL ≤ 400 KB."] }, { status: 400 });
      }
      patch.companyLogoDataUrl = clean;
    } else {
      patch.companyLogoDataUrl = null; // removal
    }
  }
  if (body.companyLogoWidthIn !== undefined) {
    const w = Number(body.companyLogoWidthIn);
    if (Number.isFinite(w)) patch.companyLogoWidthIn = Math.min(2.6, Math.max(0.4, w));
  }
  if ("signatureDataUrl" in body) {
    if (body.signatureDataUrl) {
      const clean = sanitizeDataUrl(body.signatureDataUrl, "image", 400_000);
      if (!clean) {
        return NextResponse.json({ errors: ["Signature must be a PNG/JPEG data URL ≤ 400 KB."] }, { status: 400 });
      }
      patch.signatureDataUrl = clean;
    } else {
      patch.signatureDataUrl = null;
    }
  }
  if ("micrFontDataUrl" in body) {
    if (body.micrFontDataUrl) {
      const clean = sanitizeDataUrl(body.micrFontDataUrl, "font", 2_000_000);
      if (!clean) {
        return NextResponse.json({ errors: ["Font must be a TTF/OTF/WOFF/WOFF2 data URL ≤ 2 MB."] }, { status: 400 });
      }
      patch.micrFontDataUrl = clean;
    } else {
      patch.micrFontDataUrl = null;
    }
  }
  if (body.micrFontSizePt !== undefined) {
    const size = Number(body.micrFontSizePt);
    if (Number.isFinite(size)) patch.micrFontSizePt = Math.min(20, Math.max(6, size));
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ errors: ["Nothing to update"] }, { status: 400 });
  }

  const [row] = await db.update(bankAccounts).set(patch).where(eq(bankAccounts.id, id)).returning();
  await logEvent(null, "account-updated", `Account "${row.label}" edited`);
  return NextResponse.json({ account: row });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const confirmed = url.searchParams.get("confirm") === "1";
  if (!id) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });

  const [existing] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
  if (!existing) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });

  const [{ n }] = await db
    .select({ n: count() })
    .from(checks)
    .where(eq(checks.accountId, id));

  if (!confirmed) {
    return NextResponse.json(
      { errors: [`Delete requires ?confirm=1 — this account has ${n} check record(s).`], checks: n },
      { status: 409 },
    );
  }
  if (n > 0) {
    return NextResponse.json(
      {
        errors: [
          `This account still carries ${n} check record(s) in the register and the audit trail. Void or retain them; reconcile the account rather than deleting it.`,
        ],
      },
      { status: 409 },
    );
  }

  await logEvent(null, "account-deleted", `Account "${existing.label}" deleted`);
  await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  return NextResponse.json({ ok: true });
}
