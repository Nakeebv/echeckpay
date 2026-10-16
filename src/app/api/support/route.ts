import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportThreads } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX_BODY = 4000;

/** List the signed-in user's support threads (with message counts). */
export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const threads = await db
    .select()
    .from(supportThreads)
    .where(eq(supportThreads.userId, auth.user.id))
    .orderBy(desc(supportThreads.updatedAt))
    .limit(25);
  return NextResponse.json({ threads });
}

/** Open a new thread. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { subject?: string; body?: string };
  const subject = String(body.subject ?? "").trim().slice(0, 160);
  const text = String(body.body ?? "").trim().slice(0, MAX_BODY);
  if (!subject || !text) {
    return NextResponse.json({ errors: ["Subject and message are required."] }, { status: 400 });
  }
  const [thread] = await db
    .insert(supportThreads)
    .values({ userId: auth.user.id, subject, status: "open" })
    .returning();
  await db.insert(supportMessages).values({
    threadId: thread.id,
    authorRole: "user",
    body: text,
  });
  return NextResponse.json({ thread }, { status: 201 });
}

/** Reply to an existing thread (owner only). */
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { threadId?: number; body?: string };
  const threadId = Math.trunc(Number(body.threadId));
  const text = String(body.body ?? "").trim().slice(0, MAX_BODY);
  if (!threadId || !text) {
    return NextResponse.json({ errors: ["threadId and body are required."] }, { status: 400 });
  }
  const [thread] = await db
    .select()
    .from(supportThreads)
    .where(and(eq(supportThreads.id, threadId), eq(supportThreads.userId, auth.user.id)))
    .limit(1);
  if (!thread) return NextResponse.json({ errors: ["Not found."] }, { status: 404 });

  await db.insert(supportMessages).values({ threadId, authorRole: "user", body: text });
  await db
    .update(supportThreads)
    .set({ status: "open", updatedAt: new Date() })
    .where(eq(supportThreads.id, threadId));
  return NextResponse.json({ ok: true });
}
