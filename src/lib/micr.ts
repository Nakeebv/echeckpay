/**
 * ANSI X9.100 / X9.27 (E-13B) MICR layout engine.
 *
 * Key spec constants (ABA "MICR Basics" + ANSI X9.7 / X9.13 / X9.27):
 *  - Character pitch is exactly 8 characters per inch (1/8" per position).
 *  - The MICR line has up to 65 positions, numbered RIGHT to LEFT.
 *  - The clear band is 5/8" tall, measured from the aligning (bottom) edge,
 *    and must contain no magnetic ink other than E-13B characters.
 *  - The 1/4" print band begins 3/16" above the aligning edge (the baseline).
 *  - Horizontally the line begins 5/16" from the leading (right) edge.
 *  - Fields, right to left: Amount (1-12), On-Us (13-32), Transit (33-43),
 *    EPC (44 or 45), Auxiliary On-Us (45/46-65).
 */

export const MICR_PITCH = 0.125; // inches per character position
export const MICR_LEADING_EDGE = 0.3125; // 5/16" from the right edge
export const MICR_BASELINE = 0.1875; // 3/16" above the bottom edge
export const MICR_PRINT_BAND = 0.25; // print band height
export const MICR_CLEAR_BAND = 0.625; // 5/8" clear band
export const MICR_CHAR_HEIGHT = 0.125; // 3.175 mm nominal character height

/** Number of usable data positions in the On-Us field (13-32, blanks reserved). */
export const ON_US_MAX = 18;

export type MicrGlyph = {
  /** glyph width in design units */
  w: number;
  /** glyph height in design units */
  h: number;
  /** single path outline */
  d?: string;
  /** rounded-rect strokes (symbols are built from bars) */
  rects?: [number, number, number, number][];
};

/**
 * E-13B vector strokes. Glyph geometry derived from the ISO 1004 / Payments
 * Canada stroke specification (SIL OFL 1.1, (c) 2021 Zachary Schneider) and
 * rendered as vectors so output is printer-resolution independent.
 */
export const MICR_GLYPHS: Record<string, MicrGlyph> = {
  "0": {
    w: 6.37,
    h: 8.42,
    d: "M4.5,8.42H1.87A1.87,1.87,0,0,1,0,6.55V1.87A1.87,1.87,0,0,1,1.87,0H4.5A1.87,1.87,0,0,1,6.37,1.87V6.55A1.87,1.87,0,0,1,4.5,8.42ZM5.59,6.55V1.87A.92.92,0,0,0,4.66.94H1.71a.92.92,0,0,0-.93.93V6.55a.93.93,0,0,0,.93.94h3A.93.93,0,0,0,5.59,6.55Z",
  },
  "1": {
    w: 3.74,
    h: 8.42,
    d: "M0,0H0.94V7.48H3.74V8.42H0Z",
  },
  "2": {
    w: 3.74,
    h: 8.42,
    d: "M3.74,0V4.21H0.94V7.48H3.74V8.42H0V3.27H2.8V0.94H0V0Z",
  },
  "3": {
    w: 4.68,
    h: 8.42,
    d: "M4.68,0V8.42H0V7.48H3.74V4.68H1.87V3.74H3.74V0.94H0V0Z",
  },
  "4": {
    w: 5.62,
    h: 8.42,
    d: "M3.74,5.15a.46.46,0,0,1-.46.47H2.34a.47.47,0,0,1-.47-.47V.47A.47.47,0,0,0,1.4,0H.47A.47.47,0,0,0,0,.47V6.09a.47.47,0,0,0,.47.46H3.28A.46.46,0,0,1,3.74,7V8a.47.47,0,0,0,.47.46h.94A.47.47,0,0,0,5.62,8V5.15a.48.48,0,0,0-.47-.47H4.21a.48.48,0,0,0-.47.47Z",
  },
  "5": {
    w: 4.68,
    h: 8.42,
    d: "M4.68,0V3.74H1.41a.47.47,0,0,1-.47-.47V1.4A.45.45,0,0,1,1.4.94H4.21a.47.47,0,1,0,0-.94H.47A.47.47,0,0,0,0,.47V4.21a.47.47,0,0,0,.47.47h2.8a.47.47,0,0,1,.47.47V7a.47.47,0,0,1-.47.47H.46a.47.47,0,1,0,0,.93H4.21A.47.47,0,0,0,4.68,8V4.22A.48.48,0,0,0,4.21,3.74Z",
  },
  "6": {
    w: 5.62,
    h: 8.42,
    d: "M2.81,1.4A.46.46,0,0,0,2.34.94H1.4a.45.45,0,0,0-.46.46V4.21a.46.46,0,0,0,.46.47H5.15a.48.48,0,0,1,.47.47V8a.47.47,0,0,1-.47.46H.47A.47.47,0,0,1,0,8V.47A.47.47,0,0,1,.47,0H3.28a.47.47,0,0,1,.46.47v1.4a.47.47,0,1,1-.93,0ZM4.68,6.08a.46.46,0,0,0-.47-.46H1.4a.45.45,0,0,0-.46.46V7a.46.46,0,0,0,.46.47H4.21A.47.47,0,0,0,4.68,7Z",
  },
  "7": {
    w: 4.68,
    h: 8.42,
    d: "M.94,1.4A.47.47,0,0,1,1.4.94H3.28a.45.45,0,0,1,.46.46V2.8a.47.47,0,0,1-.27.43l-1.32.59a.46.46,0,0,0-.28.43V8a.47.47,0,0,0,.94,0V4.86a.46.46,0,0,1,.27-.43L4.4,3.84a.47.47,0,0,0,.28-.43V.47A.44.44,0,0,0,4.54.14.44.44,0,0,0,4.21,0H.47A.47.47,0,0,0,0,.47V2.34a.47.47,0,0,0,.47.47.48.48,0,0,0,.47-.47Z",
  },
  "8": {
    w: 6.55,
    h: 8.42,
    d: "M2.34.94H4.21a.46.46,0,0,1,.47.46V3.28a.46.46,0,0,1-.47.46H2.34a.46.46,0,0,1-.47-.46V1.4A.46.46,0,0,1,2.34.94ZM1.87,7V5.15a.47.47,0,0,1,.47-.47H4.21a.47.47,0,0,1,.47.47V7a.47.47,0,0,1-.47.47H2.34A.47.47,0,0,1,1.87,7ZM6.08,4.21a.46.46,0,0,1-.46-.47h0V.47A.47.47,0,0,0,5.15,0H1.4A.48.48,0,0,0,.93.47V3.74h0a.47.47,0,0,1-.47.47h0A.47.47,0,0,0,0,4.68V8a.47.47,0,0,0,.47.46H6.08A.47.47,0,0,0,6.55,8V4.68a.47.47,0,0,0-.47-.47Z",
  },
  "9": {
    w: 5.62,
    h: 8.42,
    d: "M5.48.14A.45.45,0,0,0,5.15,0H.47A.47.47,0,0,0,0,.47V4.21a.47.47,0,0,0,.47.47H3.28a.46.46,0,0,1,.46.47V8a.47.47,0,0,0,.47.46h.94A.47.47,0,0,0,5.62,8V.47A.48.48,0,0,0,5.48.14ZM1.4,3.74a.45.45,0,0,1-.46-.46V1.4A.45.45,0,0,1,1.4.94H4.21a.46.46,0,0,1,.47.46V3.28a.46.46,0,0,1-.47.46Z",
  },
  // Transit symbol
  T: {
    w: 6.55,
    h: 8.42,
    rects: [
      [0, 1.4, 1.87, 5.62],
      [3.74, 0, 2.81, 2.81],
      [3.74, 5.62, 2.81, 2.81],
    ],
  },
  // Amount symbol
  A: {
    w: 6.55,
    h: 8.42,
    rects: [
      [0, 4.68, 1.87, 3.74],
      [4.68, 0, 1.87, 3.74],
      [2.81, 2.1, 0.94, 4.21],
    ],
  },
  // On-Us symbol
  U: {
    w: 6.55,
    h: 6.55,
    rects: [
      [3.74, 0, 2.81, 3.74],
      [1.87, 0.94, 0.94, 5.62],
      [0, 0.94, 0.94, 5.62],
    ],
  },
  // Dash symbol
  D: {
    w: 6.55,
    h: 3.74,
    rects: [
      [0, 0, 1.87, 3.74],
      [2.81, 0, 1.87, 3.74],
      [5.61, 0, 0.94, 3.74],
    ],
  },
};

export const TRANSIT = "T";
export const AMOUNT = "A";
export const ON_US = "U";
export const DASH = "D";

/**
 * MICR typeface calibration. Every commercial E-13B face is drawn on a
 * 0.75 em advance so that at exactly 12 pt the character pitch is 1/8 inch —
 * 8 characters per inch, which is what the position grid demands.
 */
export const MICR_FONT_SIZE_PT = 12;
export const MICR_ADVANCE_EM = 0.75;

/** Internal glyph code → the ASCII key MICR fonts use (A/B/C/D = TOAD). */
export function micrFontChar(ch: string): string {
  if (ch === "T") return "A"; // transit
  if (ch === "A") return "B"; // amount
  if (ch === "U") return "C"; // on-us
  if (ch === "D") return "D"; // dash
  return ch;
}

export type MicrRun = {
  field: MicrChar["field"];
  /** left edge in inches of the run's first character cell */
  x: number;
  /** characters, left to right, in the font's own key mapping */
  text: string;
};

/**
 * Group the positioned characters into contiguous runs (one per MICR field).
 * Runs are laid out independently at their exact ANSI x position so the pitch
 * never depends on how a substituted font measures its space character.
 */
export function micrRuns(chars: MicrChar[]): MicrRun[] {
  const byField = new Map<MicrChar["field"], MicrChar[]>();
  for (const c of chars) {
    const list = byField.get(c.field) ?? [];
    list.push(c);
    byField.set(c.field, list);
  }
  const runs: MicrRun[] = [];
  for (const [field, list] of byField) {
    const sorted = list.slice().sort((a, b) => a.x - b.x);
    if (!sorted.length) continue;
    runs.push({
      field,
      x: sorted[0].x,
      text: sorted.map((c) => micrFontChar(c.ch)).join(""),
    });
  }
  return runs.sort((a, b) => a.x - b.x);
}

/** Right edge (inches from the check's left edge) of a given MICR position. */
export function micrCellRight(checkWidthIn: number, position: number): number {
  return checkWidthIn - MICR_LEADING_EDGE - (position - 1) * MICR_PITCH;
}

export function micrCellLeft(checkWidthIn: number, position: number): number {
  return micrCellRight(checkWidthIn, position) - MICR_PITCH;
}

export type MicrChar = {
  /** source character, e.g. "7" or "T" */
  ch: string;
  /** left edge in inches from the check's left edge */
  x: number;
  /** cell width in inches */
  w: number;
  /** field the character belongs to */
  field: "transit" | "onUs" | "auxOnUs" | "amount" | "epc";
};

export type MicrLayout = {
  chars: MicrChar[];
  /** human readable string, e.g. "T075900013T 0123456789U 1234" */
  text: string;
  clearBandTop: number;
  errors: string[];
  warnings: string[];
  fieldPositions: {
    transit: [number, number];
    onUs: [number, number];
    auxOnUs: [number, number] | null;
    amount: [number, number];
  };
};

export type OnUsFormat = "account-symbol-serial" | "account-symbol" | "symbol-account";

export type MicrInput = {
  checkWidthIn: number;
  routingNumber: string;
  accountNumber: string;
  checkNumber: string;
  onUsFormat?: OnUsFormat;
  /** business (>= 6.5") checks carry the serial in the Auxiliary On-Us field */
  auxOnUs?: boolean;
  /** pre-encode the Amount field (normally left blank for the bank of first deposit) */
  includeAmount?: boolean;
  amountCents?: number | null;
};

export function buildOnUsField(
  accountNumber: string,
  checkNumber: string,
  format: OnUsFormat,
  auxOnUs: boolean,
): string {
  const acct = accountNumber.replace(/[^0-9]/g, "");
  const serial = checkNumber.replace(/[^0-9]/g, "");
  if (auxOnUs) return `${acct}U`;
  switch (format) {
    case "account-symbol":
      return `${acct}U`;
    case "symbol-account":
      return `U${acct}U`;
    case "account-symbol-serial":
    default:
      return `${acct}U${serial}`;
  }
}

/**
 * Lay the MICR line out on the E-13B position grid. Every character is placed
 * on an exact 1/8" cell so the printed line lands on ANSI position tolerances.
 */
export function layoutMicr(input: MicrInput): MicrLayout {
  const { checkWidthIn } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const chars: MicrChar[] = [];
  const routing = input.routingNumber.replace(/[^0-9]/g, "");
  const auxOnUs = Boolean(input.auxOnUs) && checkWidthIn > 6.5;

  if (routing.length !== 9) errors.push("Routing number must be exactly 9 digits.");
  if (!isRoutingValid(routing)) errors.push("Routing number fails the ABA mod-10 check-digit test.");

  // ---- Transit field: positions 43..33 (left to right) --------------------
  const transitString = `T${routing}T`;
  for (let i = 0; i < transitString.length; i += 1) {
    const pos = 43 - i;
    chars.push({
      ch: transitString[i],
      x: micrCellLeft(checkWidthIn, pos),
      w: MICR_PITCH,
      field: "transit",
    });
  }

  // ---- On-Us field: data begins at position 30 ----------------------------
  // ANSI X9.6 field layout: exactly two blank symbol positions (31 and 32)
  // separate the Transit field from the On-Us data — a fixed 1/4" gap, never
  // scaled by account length. Data fills RIGHTWARD from position 30 toward
  // the Amount field, reaching position 13 only when the full 18-position
  // payload is encoded.
  const onUsString = buildOnUsField(
    input.accountNumber,
    input.checkNumber,
    input.onUsFormat ?? "account-symbol-serial",
    auxOnUs,
  );
  const onUsData = onUsString.replace(/[^0-9UD ]/g, "");
  if (onUsData.replace(/ /g, "").length === 0) errors.push("Account number is required for the On-Us field.");
  if (onUsData.length > ON_US_MAX) {
    errors.push(
      `On-Us field is ${onUsData.length} characters; ANSI limits the field to ${ON_US_MAX} usable positions (13-32).`,
    );
  }
  const onUsStart = 30; // two blank positions (31-32) after the Transit field
  for (let i = 0; i < onUsData.length; i += 1) {
    const pos = onUsStart - i;
    chars.push({
      ch: onUsData[i],
      x: micrCellLeft(checkWidthIn, pos),
      w: MICR_PITCH,
      field: "onUs",
    });
  }

  // ---- Auxiliary On-Us: serial number, right-aligned to position 45 -------
  let auxRange: [number, number] | null = null;
  if (auxOnUs) {
    const serial = input.checkNumber.replace(/[^0-9]/g, "");
    const auxString = `U${serial}U`;
    const start = 45; // rightmost position of the aux field
    for (let i = 0; i < auxString.length; i += 1) {
      const pos = start + auxString.length - 1 - i;
      chars.push({
        ch: auxString[i],
        x: micrCellLeft(checkWidthIn, pos),
        w: MICR_PITCH,
        field: "auxOnUs",
      });
    }
    const leftmost = start + auxString.length - 1;
    const leftEdge = micrCellLeft(checkWidthIn, leftmost);
    if (leftEdge < 0.25) warnings.push("Auxiliary On-Us field is close to the left trim edge (min 1/4\").");
    auxRange = [leftEdge, micrCellRight(checkWidthIn, start)];
  }

  // ---- Amount field (optional, normally encoded by the bank) --------------
  let amountString = "";
  if (input.includeAmount) {
    const cents = Math.max(0, Math.round(input.amountCents ?? 0));
    const dollars = Math.floor(cents / 100);
    const rem = cents % 100;
    if (dollars > 99999999) {
      errors.push("Amount exceeds the 8-digit Amount field capacity ($99,999,999.99).");
    }
    amountString = `A${String(rem).padStart(2, "0")}${String(dollars).padStart(8, "0")}A`;
    warnings.push(
      "The Amount field is normally encoded by the bank of first deposit. Printing it is only correct for pre-encoded items.",
    );
  }
  for (let i = 0; i < amountString.length; i += 1) {
    const pos = 12 - i;
    chars.push({
      ch: amountString[i],
      x: micrCellLeft(checkWidthIn, pos),
      w: MICR_PITCH,
      field: "amount",
    });
  }

  const fieldPositions = {
    transit: [micrCellLeft(checkWidthIn, 43), micrCellRight(checkWidthIn, 33)] as [number, number],
    onUs: [micrCellLeft(checkWidthIn, 31), micrCellRight(checkWidthIn, 13)] as [number, number],
    auxOnUs: auxRange,
    amount: [micrCellLeft(checkWidthIn, 12), micrCellRight(checkWidthIn, 1)] as [number, number],
  };

  const text = chars
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((c) => c.ch)
    .join("");

  return {
    chars,
    text,
    clearBandTop: MICR_CLEAR_BAND,
    errors,
    warnings,
    fieldPositions,
  };
}

/** ABA mod-10 routing number check digit validation. */
export function isRoutingValid(routing: string): boolean {
  const r = routing.replace(/[^0-9]/g, "");
  if (r.length !== 9) return false;
  const digits = r.split("").map(Number);
  const sum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8]);
  return sum % 10 === 0;
}

export function routingCheckDigit(first8: string): number {
  const d = first8.replace(/[^0-9]/g, "").split("").map(Number);
  if (d.length !== 8) return -1;
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5]);
  return (10 - (sum % 10)) % 10;
}

/** Federal Reserve district / clearing region from a routing number. */
export function routingDistrict(routing: string): string {
  const r = routing.replace(/[^0-9]/g, "");
  if (r.length < 4) return "—";
  const districts: Record<string, string> = {
    "01": "Boston",
    "02": "New York",
    "03": "Philadelphia",
    "04": "Cleveland",
    "05": "Richmond",
    "06": "Atlanta",
    "07": "Chicago",
    "08": "St. Louis",
    "09": "Minneapolis",
    "10": "Kansas City",
    "11": "Dallas",
    "12": "San Francisco",
  };
  const prefix = r.slice(0, 2);
  const office = r[2];
  const district = districts[prefix] ?? "Thrift / special";
  const officeType =
    office === "0"
      ? "primary Federal Reserve office"
      : office === "1" || office === "2" || office === "3"
        ? "branch office"
        : "special collection arrangement";
  return `${district} — ${officeType}`;
}

/** Build the fractional routing number (e.g. 12-3456/7890) from a routing number. */
export function fractionFromRouting(routing: string): string {
  const r = routing.replace(/[^0-9]/g, "");
  if (r.length !== 9) return "";
  // numerator: district prefix + institution segment; denominator: first 4 digits
  const denominator = r.slice(0, 4);
  const numerator = r.slice(0, 2) + "-" + r.slice(4, 8);
  return `${numerator}/${denominator}`;
}
