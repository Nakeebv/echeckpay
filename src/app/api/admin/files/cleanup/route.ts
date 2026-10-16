import { NextResponse } from "next/server";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { bankAccounts, files } from "@/db/schema";
import { requireApiAdmin } from "@/lib/auth";
import { r2DeleteMany, r2List } from "@/lib/r2";
import { logEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Orphan sweep (admin action, run manually or from a cron):
 *  1. rows marked replaced/deleted whose objects still exist → delete object
 *  2. bucket objects under managed prefixes with no active DB row → delete
 */
export async function POST() {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  // managed prefixes (every category we actively use)
  const prefixes = ["logo_bank/", "logo_company/", "signature/", "micr_font/", "check_pdf/", "profile/"];

  // rows that still point to live objects
  const active = await db.select({ key: files.objectKey, status: files.status }).from(files);

  const bucketKeys = await r2List("");

  const referenced = new Set<string>();
  for (const [table, columns] of [
    [bankAccounts, { a: bankAccounts.logoDataUrl, b: bankAccounts.companyLogoDataUrl, c: bankAccounts.signatureDataUrl, d: bankAccounts.micrFontDataUrl }],
  ] as const) {
    const rows = await db.select(columns).from(table).where(eq(table.isActive, true));
    for (const row of rows) {
      for (const ref of [row.a, row.b, row.c, row.d]) {
        if (ref && ref.startsWith("r2:")) {
          try {
            const r = await db
              .select({ key: files.objectKey })
              .from(files)
              .where(and(eq(files.id, ref.slice(3)), notInArray(files.status, ["deleted"])))
              .limit(1);
            if (r[0]?.key) referenced.add(r[0].key);
          } catch {
            /* malformed ref — ignore */
          }
        }
      }
    }
  }

  const activeKeys = new Set(active.filter((r) => r.status === "active").map((r) => r.key));
  const staleKeys = active.filter((r) => r.status !== "active" && bucketKeys.includes(r.key)).map((r) => r.key);
  const orphanKeys = bucketKeys.filter((k) => prefixes.some((p) => k.startsWith(p)) && !activeKeys.has(k) && !referenced.has(k));

  await r2DeleteMany([...new Set([...staleKeys, ...orphanKeys])]);

  await logEvent(auth.user.id, null, "r2-cleanup", `deleted ${staleKeys.length} stale + ${orphanKeys.length} orphan object(s)`, "admin");
  return NextResponse.json({ ok: true, deletedStale: staleKeys.length, deletedOrphans: orphanKeys.length });
}
