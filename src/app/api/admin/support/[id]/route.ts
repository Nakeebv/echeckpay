import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportThreads, users } from "@/db/schema";
import { requireApiAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** One support thread + its conversation — admin only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  const id = Math.trunc(Number((await params).id));
  const [thread] = await db.select().from(supportThreads).where(eq(supportThreads.id, id)).limit(1);
  if (!thread) return NextResponse.json({ errors: ["Not found"] }, { status: 404 });

  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, thread.userId)).limit(1);
  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.threadId, thread.id))
    .orderBy(asc(supportMessages.id));

  return NextResponse.json({ thread: { ...thread, userEmail: owner?.email ?? "" }, messages });
}
