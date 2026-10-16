import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 (S3-compatible) storage. All credentials and signing stay on
 * the server — the browser never sees keys, and private objects are only
 * reachable through server-authorised routes.
 */
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim() || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim() || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
export const R2_BUCKET = process.env.R2_BUCKET?.trim() || "";
export const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE?.trim().replace(/\/$/, "") || "";

/** R2 is treated as configured only when every credential is present. */
export function r2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && R2_BUCKET);
}

function client(): AwsClient {
  if (!r2Configured()) throw new Error("R2 not configured");
  return new AwsClient({
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

function endpoint(key: string): string {
  return `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** PUT an object. Returns false when R2 is not configured. */
export async function r2Put(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<boolean> {
  if (!r2Configured()) return false;
  const c = client();
  const res = await c.fetch(endpoint(key), {
    method: "PUT",
    body: body as unknown as BodyInit,
    headers: { "content-type": contentType },
  });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
  return true;
}

/** GET an object as bytes, or null when missing. */
export async function r2Get(key: string): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  if (!r2Configured()) return null;
  const c = client();
  const res = await c.fetch(endpoint(key), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, contentType: res.headers.get("content-type") };
}

/** DELETE an object (no-op when missing). */
export async function r2Delete(key: string): Promise<void> {
  if (!r2Configured()) return;
  const c = client();
  await c.fetch(endpoint(key), { method: "DELETE" }).catch(() => {});
}

/** DELETE many keys in parallel (cleanup tooling). */
export async function r2DeleteMany(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => r2Delete(k)));
}

/** List object keys under a prefix (cleanup tooling, max 1000). */
export async function r2List(prefix: string): Promise<string[]> {
  if (!r2Configured()) return [];
  const c = client();
  const res = await c.fetch(
    `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}?list-type=2&prefix=${encodeURIComponent(prefix)}`,
    { method: "GET" },
  );
  if (!res.ok) return [];
  const text = await res.text();
  const keys: string[] = [];
  const re = /<Key>([^<]+)<\/Key>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) keys.push(decodeURIComponent(m[1]));
  return keys;
}
