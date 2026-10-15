const ONES = [
  "",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
  "THIRTEEN",
  "FOURTEEN",
  "FIFTEEN",
  "SIXTEEN",
  "SEVENTEEN",
  "EIGHTEEN",
  "NINETEEN",
];

const TENS = [
  "",
  "",
  "TWENTY",
  "THIRTY",
  "FORTY",
  "FIFTY",
  "SIXTY",
  "SEVENTY",
  "EIGHTY",
  "NINETY",
];

function threeDigitToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} HUNDRED`);
  if (rest >= 20) {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    parts.push(o > 0 ? `${TENS[t]}-${ONES[o]}` : TENS[t]);
  } else if (rest > 0) {
    parts.push(ONES[rest]);
  }
  return parts.filter(Boolean).join(" ");
}

/** Words for a whole-dollar amount (0 .. 999,999,999,999). */
export function integerToWords(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "ZERO";
  const groups = [
    { size: 1_000_000_000, name: "BILLION" },
    { size: 1_000_000, name: "MILLION" },
    { size: 1_000, name: "THOUSAND" },
    { size: 1, name: "" },
  ];
  let remaining = Math.floor(Math.abs(value));
  const out: string[] = [];
  for (const g of groups) {
    const q = Math.floor(remaining / g.size);
    if (q > 0) {
      out.push(`${threeDigitToWords(q)}${g.name ? ` ${g.name}` : ""}`);
      remaining -= q * g.size;
    }
  }
  return out.join(" ");
}

export function formatCents(cents: number): string {
  const safe = Math.round(cents || 0);
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return `${negative ? "-" : ""}$${Number(s).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPlain(cents: number): string {
  const safe = Math.round(cents || 0);
  return `${Math.floor(Math.abs(safe) / 100)}.${String(Math.abs(safe) % 100).padStart(2, "0")}`;
}

/**
 * The "legal amount" — words plus cents fraction, exactly as required on the
 * face of a negotiable instrument (UCC 3-114). When words and numerals differ,
 * the words control.
 */
export function legalAmount(cents: number): string {
  const safe = Math.round(cents || 0);
  const dollars = Math.floor(Math.abs(safe) / 100);
  const rem = Math.abs(safe) % 100;
  const words = integerToWords(dollars);
  return `${words} AND ${String(rem).padStart(2, "0")}/100 DOLLARS`;
}

/**
 * Parse a user-typed dollar amount into cents. Anything that is not a plain
 * decimal number with at most two fraction digits ("1500", "1,500.00", "$75")
 * parses as 0 so the caller's amount-guard rejects the check.
 */
export function parseAmountToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  if (!cleaned || !/^\d{1,12}(\.\d{0,2})?$/.test(cleaned)) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/**
 * Payee address as printed on the face, in standard form:
 *   line 1 — street address
 *   line 2 — city, state, zip
 * Multi-line records keep their split; single-line records are split at the
 * last comma separates the state/zip part. Everything is trimmed and blank
 * lines dropped, with at most two lines returned.
 */
export function formatAddressBlock(address: string): { line1: string; line2: string } {
  const lines = address
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) return { line1: "", line2: "" };
  if (lines.length >= 2) {
    return { line1: lines.slice(0, -1).join(", "), line2: lines[lines.length - 1] };
  }

  // single-line record: split at the last comma so "…, City, ST 12345"
  // becomes street / city-state-zip
  const parts = lines[0].split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { line1: parts.slice(0, -2).join(", "), line2: parts.slice(-2).join(", ") };
  }
  if (parts.length === 2) {
    return { line1: parts[0], line2: parts[1] };
  }
  return { line1: lines[0], line2: "" };
}
