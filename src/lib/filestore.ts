import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { r2Delete, r2Put } from "@/lib/r2";
import { logEvent } from "@/lib/data";

/**
 * File storage policy. Categories partition the bucket; each carries its own
 * size / extension / MIME rules. Access is private by default — public assets
 * must be marked explicitly.
 */
export type FileCategory = "logo_bank" | "logo_company" | "signature" | "micr_font" | "check_pdf" | "profile" | "other";
export type AccessLevel = "private" | "public";

const CATEGORY_RULES: Record<
  FileCategory,
  { maxSize: number; extensions: string[]; mimes: string[]; access: AccessLevel }
> = {
  logo_bank: { maxSize: 400_000, extensions: ["png", "jpg", "jpeg", "webp", "svg"], mimes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"], access: "private" },
  logo_company: { maxSize: 400_000, extensions: ["png", "jpg", "jpeg", "webp", "svg"], mimes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"], access: "private" },
  signature: { maxSize: 400_000, extensions: ["png", "jpg", "jpeg"], mimes: ["image/png", "image/jpeg"], access: "private" },
  micr_font: { maxSize: 2_000_000, extensions: ["ttf", "otf", "woff", "woff2"], mimes: ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/font-sfnt", "application/font-woff", "application/x-font-ttf", "application/octet-stream"], access: "private" },
  check_pdf: { maxSize: 5_000_000, extensions: ["pdf"], mimes: ["application/pdf"], access: "private" },
  profile: { maxSize: 1_000_000, extensions: ["png", "jpg", "jpeg", "webp"], mimes: ["image/png", "image/jpeg", "image/webp"], access: "public" },
  other: { maxSize: 400_000, extensions: ["png", "jpg", "jpeg", "webp"], mimes: ["image/png", "image/jpeg", "image/webp"], access: "private" },
};

/** Per-user lifecycle limits. */
export const MAX_FILES_PER_USER = 120;
export const MAX_UPLOADS_PER_WINDOW = 20;

const EXT_BY_MAGIC: { ext: string; mime: string; test: (b: Uint8Array) => boolean }[] = [
  { ext: "png", mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "jpeg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    ext: "pdf",
    mime: "application/pdf",
    test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    ext: "ttf",
    mime: "font/ttf",
    test: (b) => b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00,
  },
  {
    ext: "otf",
    mime: "font/otf",
    test: (b) => b[0] === 0x4f && b[1] === 0x54 && b[2] === 0x54 && b[3] === 0x4f,
  },
  {
    ext: "woff",
    mime: "font/woff",
    test: (b) => b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x46,
  },
  {
    ext: "woff2",
    mime: "font/woff2",
    test: (b) => b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x32,
  },
];

function sniff(b: Uint8Array): { ext: string; mime: string } | null {
  for (const r of EXT_BY_MAGIC) if (r.test(b)) return { ext: r.ext, mime: r.mime };
  // SVG: text starting with a tag (dangerous scripts are stripped for private
  // logo use — served with content-type text/plain only on explicit download)
  const head = new TextDecoder().decode(b.slice(0, 400)).trimStart().toLowerCase();
  if (head.startsWith("<svg") && !/<script/i.test(head)) return { ext: "svg", mime: "image/svg+xml" };
  return null;
}

export class UploadRejected extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function recentUploadCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(files)
    .where(and(eq(files.ownerUserId, userId), sql`${files.createdAt} > now() - interval '15 minutes'`));
  return row?.n ?? 0;
}

export async function ownedFileCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(files)
    .where(and(eq(files.ownerUserId, userId), eq(files.status, "active")));
  return row?.n ?? 0;
}

export type StoredFile = {
  id: string;
  category: string;
  accessLevel: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
};

/**
 * Validate + store an upload. Throws UploadRejected("…") on any rule failure.
 * Object keys are unpredictable (category/user/uuid + safe extension).
 */
export async function storeFile(params: {
  userId: number;
  category: FileCategory;
  bytes: Uint8Array;
  originalName: string;
  accessLevel?: AccessLevel;
}): Promise<StoredFile> {
  const rule = CATEGORY_RULES[params.category];
  if (!rule) throw new UploadRejected("bad_category", "Unknown file category.");

  if (params.bytes.length === 0) throw new UploadRejected("empty", "File is empty.");
  if (params.bytes.length > rule.maxSize) {
    throw new UploadRejected("too_large", `File exceeds the ${Math.floor(rule.maxSize / 1000)} KB limit for ${params.category.replace("_", " ")}.`);
  }

  const sniffed = sniff(params.bytes);
  if (!sniffed) {
    throw new UploadRejected("bad_signature", "File content does not match a supported type (magic-byte check failed).");
  }

  const safeName = (params.originalName || "file").toLowerCase();
  const ext = safeName.includes(".") ? safeName.split(".").pop()! : sniffed.ext;
  if (!rule.extensions.includes(ext) && !rule.extensions.includes(sniffed.ext)) {
    throw new UploadRejected("bad_extension", `Unsupported extension for ${params.category.replace("_", " ")}.`);
  }
  if (!rule.mimes.includes(sniffed.mime)) {
    throw new UploadRejected("bad_type", `Unsupported content type for ${params.category.replace("_", " ")}.`);
  }

  const accessLevel: AccessLevel = params.accessLevel ?? rule.access;

  const recent = await recentUploadCount(params.userId);
  if (recent >= MAX_UPLOADS_PER_WINDOW) {
    throw new UploadRejected("rate_limited", "Too many uploads — try again in a few minutes.");
  }
  const owned = await ownedFileCount(params.userId);
  if (owned >= MAX_FILES_PER_USER) {
    throw new UploadRejected("too_many_files", `File limit reached (${MAX_FILES_PER_USER}) — delete some first.`);
  }

  // unpredictable key — user-supplied names are metadata only
  const key = `${params.category}/${params.userId}/${crypto.randomUUID()}.${sniffed.ext}`;
  const stored = await r2Put(key, params.bytes, sniffed.mime);
  if (!stored) {
    throw new UploadRejected("r2_unavailable", "File storage is not configured — upload rejected.");
  }

  const id = crypto.randomUUID();
  await db.insert(files).values({
    id,
    ownerUserId: params.userId,
    category: params.category,
    accessLevel,
    originalName: safeName.slice(0, 160),
    mime: sniffed.mime,
    sizeBytes: params.bytes.length,
    objectKey: key,
    status: "active",
  });

  await logEvent(params.userId, null, "file-uploaded", `${params.category} ${safeName} (${params.bytes.length} B) stored`);

  return {
    id,
    category: params.category,
    accessLevel,
    originalName: safeName.slice(0, 160),
    mime: sniffed.mime,
    sizeBytes: params.bytes.length,
  };
}

export async function getFileRow(id: string) {
  const rows = await db.select().from(files).where(eq(files.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Replacement keeps the stale object row (status 'replaced') so the previous
 * object can be garbage-collected by the cleanup sweep.
 */
export async function replaceFile(userId: number, fileId: string, bytes: Uint8Array, originalName: string): Promise<StoredFile> {
  const row = await getFileRow(fileId);
  if (!row || row.ownerUserId !== userId || row.status !== "active") {
    throw new UploadRejected("not_found", "Existing file not found.");
  }
  const fresh = await storeFile({ userId, category: row.category as FileCategory, bytes, originalName });
  await db.update(files).set({ status: "replaced" }).where(eq(files.id, fileId));
  return fresh;
}

export async function deleteFile(ownerUserId: number, fileId: string): Promise<{ ok: boolean }> {
  const row = await getFileRow(fileId);
  if (!row || row.ownerUserId !== ownerUserId || row.status !== "active") return { ok: false };
  await r2Delete(row.objectKey);
  await db.update(files).set({ status: "deleted" }).where(eq(files.id, fileId));
  await logEvent(ownerUserId, null, "file-deleted", `${row.category} ${row.originalName} deleted`);
  return { ok: true };
}

/** Validate that an "r2:<fileId>" reference belongs to the given user and is active. */
export async function isValidOwnedRef(userId: number, ref: string): Promise<boolean> {
  if (!ref.startsWith("r2:")) return false;
  const row = await getFileRow(ref.slice(3));
  return Boolean(row && row.ownerUserId === userId && row.status === "active");
}
