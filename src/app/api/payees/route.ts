import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payees } from "@/db/schema";
import { listPayees, logEvent } from "@/lib/data";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const rows = await listPayees(user.id);
  return NextResponse.json({ payees: rows });
}

function normalize(body: Record<string, unknown>) {
  return {
    name: str(body.name).trim(),
    address: str(body.address),
    phone: str(body.phone),
    email: str(body.email),
    isBusiness: Boolean(body.isBusiness),
    defaultMemo: str(body.defaultMemo),
    notes: str(body.notes),
  };
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const body = (await request.json()) as Record<string, unknown>;
  const values = normalize(body);
  if (!values.name) return NextResponse.json({ errors: ["Payee name is required."] }, { status: 400 });
  const [row] = await db.insert(payees).values({ ...values, userId: user.id }).returning();
  await logEvent(user.id, null, "payee-created", `Payee "${row.name}" added`);
  return NextResponse.json({ payee: row }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });
  const [existing] = await db.select().from(payees).where(and(eq(payees.id, id), eq(payees.userId, user.id))).limit(1);
  if (!existing) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });
  const values = normalize(body);
  if (!values.name) return NextResponse.json({ errors: ["Payee name is required."] }, { status: 400 });
  const [row] = await db.update(payees).set(values).where(and(eq(payees.id, id), eq(payees.userId, user.id))).returning();
  await logEvent(user.id, null, "payee-updated", `Payee "${row.name}" edited`);
  return NextResponse.json({ payee: row });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const confirmed = url.searchParams.get("confirm") === "1";
  if (!id) return NextResponse.json({ errors: ["id is required"] }, { status: 400 });
  const [existing] = await db.select().from(payees).where(eq(payees.id, id)).limit(1);
  if (!existing) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });
  if (!confirmed) {
    return NextResponse.json({ errors: ["Delete requires ?confirm=1."] }, { status: 409 });
  }
  await logEvent(user.id, null, "payee-deleted", `Payee "${existing.name}" deleted (record detached from past checks)`);
  await db.delete(payees).where(and(eq(payees.id, id), eq(payees.userId, user.id)));
  return NextResponse.json({ ok: true });
}
