import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    const err = error as Error & { cause?: unknown };
    const cause = err?.cause as Error | undefined;
    console.error(
      "health: database check failed",
      err?.message,
      cause?.name ?? "",
      cause?.message ?? "",
    );
    // Diagnostics (temporary): why did pg miss the Cloudflare socket path?
    console.error(
      "health: pg-diagnostics",
      JSON.stringify({
        ua: typeof navigator === "object" ? navigator?.userAgent : "no-navigator",
        wsPair: typeof (globalThis as Record<string, unknown>).WebSocketPair,
      }),
    );
    // Surface drizzle-wrapped causes for any failing page query triggered alongside.
    console.error("health: last-db-cause", String(cause?.message ?? ""), String((cause as { code?: string })?.code ?? ""));
    return Response.json({ ok: false }, { status: 500 });
  }
}
