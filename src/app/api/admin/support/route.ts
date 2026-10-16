import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportThreads, users } from "@/db/schema";
import { requireApiAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin support console: list all threads or act on one. */
export async function GET() {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;
  const threads = await db
    .select({
      id: supportThreads.id,
      userId: supportThreads.userId,
      subject: supportThreads.subject,
      status: supportThreads.status,
      updatedAt: supportThreads.updatedAt,
      userEmail: users.email,
    })
    .from(supportThreads)
    .innerJoin(users, eq(supportThreads.userId, users.id))
    .orderBy(desc(supportThreads.updatedAt))
    .limit(100);
  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    threadId?: number;
    reply?: string;
    status?: "open" | "answered" | "closed";
  };
  const threadId = Math.trunc(Number(body.threadId));
  if (!threadId) return NextResponse.json({ errors: ["threadId is required."] }, { status: 400 });

  if (body.reply) {
    await db.insert(supportMessages).values({
      threadId,
      authorRole: "admin",
      body: String(body.reply).slice(0, 4000),
    });
    await db
      .update(supportThreads)
      .set({ status: body.status ?? "answered", updatedAt: new Date() })
      .where(eq(supportThreads.id, threadId));
  } else if (body.status) {
    await db
      .update(supportThreads)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(supportThreads.id, threadId));
  }
  const [thread] = await db
    .select()
    .from(supportThreads)
    .where(and(eq(supportThreads.id, threadId)))
    .limit(1);
  const messages = thread
    ? await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.threadId, threadId))
        .orderBy(asc(supportMessages.id))
    : [];
  return NextResponse.json({ thread, messages });
}
