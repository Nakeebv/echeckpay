/**
 * Server-side validation for user-supplied `data:` URLs (logos, signatures,
 * uploaded MICR fonts). Anything that is not an exact `data:<mime>;base64,<...>`
 * payload within the size budget is rejected — this is what keeps arbitrary
 * strings out of `<img src>` and out of `@font-face src:url(...)` CSS.
 */
export type DataUrlKind = "image" | "font";

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const FONT_MIMES = ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/x-font-ttf"];

const DATA_URL_RE = /^data:([a-z0-9.+\/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;

export function sanitizeDataUrl(raw: unknown, kind: DataUrlKind, maxBytes: number): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const match = DATA_URL_RE.exec(raw);
  if (!match) return null;
  const [, mime, b64] = match;
  const allowed = kind === "image" ? IMAGE_MIMES : FONT_MIMES;
  if (!allowed.includes(mime)) return null;

  // decode just enough to enforce the byte budget (base64 = ~4/3 overhead)
  const approxBytes = Math.floor((b64.replace(/\s/g, "").length * 3) / 4);
  if (approxBytes > maxBytes) return null;

  // validate base64 strictly
  try {
    const decoded = Buffer.from(b64.replace(/\s/g, ""), "base64");
    if (!decoded.length) return null;
  } catch {
    return null;
  }
  return raw;
}
