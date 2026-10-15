import { LAYOUTS, getLayout, type LayoutId } from "@/lib/layouts";
import { isRoutingValid, layoutMicr, ON_US_MAX, type OnUsFormat } from "@/lib/micr";

/**
 * Security feature catalogue. These map 1:1 to the features printed on the
 * check face/back and to the warnings banks look for when they decide whether
 * an item is a legitimate, machine-readable negotiable document.
 */
export type FeatureGroup = "structural" | "printed" | "optical" | "chemical" | "process";

export type SecurityFeature = {
  id: string;
  label: string;
  group: FeatureGroup;
  standard: string;
  description: string;
  /** printed on the back-of-document security disclosure box */
  onBack: boolean;
};

export const SECURITY_FEATURES: SecurityFeature[] = [
  {
    id: "micr_e13b",
    label: "E-13B MICR line @ 8 chars/inch",
    group: "structural",
    standard: "ANSI X9.27 / ISO 1004-1",
    description:
      "Routing, account and serial characters rendered as true E-13B vectors on the 1/8\" position grid inside the 5/8\" clear band.",
    onBack: true,
  },
  {
    id: "clear_band",
    label: "Protected 5/8\" MICR clear band",
    group: "structural",
    standard: "ANSI X9.100-160-1",
    description:
      "No artwork, tint, microprint or reverse type inside the clear band. Background and border art are clipped above the band.",
    onBack: true,
  },
  {
    id: "padlock",
    label: "ABA padlock security icon",
    group: "printed",
    standard: "ABA / CPA voluntary icon",
    description:
      "Closed padlock icon plus the \"security features\" disclosure box telling the accepting bank exactly which features to verify.",
    onBack: true,
  },
  {
    id: "microprint",
    label: "Microprinted border & signature rule",
    group: "printed",
    standard: "Industry standard (2pt / smaller)",
    description:
      "Hairline border and the signature rule are set in microtype that collapses into a solid line when photocopied or scanned.",
    onBack: true,
  },
  {
    id: "watermark",
    label: "Guilloche engraved background",
    group: "optical",
    standard: "Industry standard (security engraving)",
    description:
      "Hairline curved lattice of the kind used on banknotes and security paper. A copier flattens it into a solid band and a scanner moirés it, so a copy is visibly not the original.",
    onBack: true,
  },
  {
    id: "prismatic",
    label: "Prismatic two-tone security screen",
    group: "optical",
    standard: "Industry standard",
    description:
      "Dual-hue background screen behind the payee and legal amount, tuned to drop out of black-and-white scanning.",
    onBack: true,
  },
  {
    id: "uv_fibers",
    label: "UV fluorescent fibres & ink",
    group: "optical",
    standard: "Industry standard",
    description:
      "Invisible fibers and a UV-reactive seal that fluoresce under 365nm inspection at the teller line.",
    onBack: true,
  },
  {
    id: "chem_reactive",
    label: "Chemical-reactive stain",
    group: "chemical",
    standard: "Industry standard",
    description:
      "Solvent-sensitive chemistry produces a permanent brown/green stain and a \"VOID\" bloom if the document is washed.",
    onBack: true,
  },
  {
    id: "thermochromic",
    label: "Thermochromic heat indicator",
    group: "chemical",
    standard: "Industry standard",
    description:
      "Rub-to-verify icon that disappears with body heat and returns as it cools — defeats thermal-transfer counterfeits.",
    onBack: true,
  },
  {
    id: "erasure_guard",
    label: "Erasure & toner-fusion guard",
    group: "chemical",
    standard: "Industry standard",
    description:
      "Toner adhesion and surface sizing designed so abrasion tears the sheet instead of lifting the printed amount.",
    onBack: true,
  },
  {
    id: "warning_band",
    label: "Backer warning clause",
    group: "printed",
    standard: "UCC 3-407 / bank deposit rules",
    description:
      "The required rear warning statement listing the document's security features and the reporting instructions for altered items.",
    onBack: true,
  },
  {
    id: "legal_amount_guard",
    label: "Legal amount asterisk guard",
    group: "structural",
    standard: "UCC 3-114",
    description:
      "Words control over numerals, and the word line is asterisk-filled to the right so nothing can be appended.",
    onBack: false,
  },
  {
    id: "fraction",
    label: "Fractional transit number",
    group: "structural",
    standard: "ABA routing convention (optional)",
    description:
      "Optional manual-sort fallback: the fractional transit number typed on the account is printed in the top-right corner. Never auto-generated — enable only if your bank wants it.",
    onBack: false,
  },
  {
    id: "void_90_days",
    label: "Print “VOID AFTER 90 DAYS”",
    group: "printed",
    standard: "UCC 3-108(b) — 90-day limit",
    description:
      "Notices the drawee bank beside the amount box that the item is void after 90 days (UCC 3-108(b) lets banks refuse a check presented more than 90 days after its date).",
    onBack: false,
  },
  {
    id: "void_180_days",
    label: "Print “VOID AFTER 180 DAYS”",
    group: "printed",
    standard: "Optional longer stale window",
    description:
      "Same notice with a 180-day window. Selecting either print expires the other; only one notice appears on the instrument.",
    onBack: false,
  },
  {
    id: "sequential_serial",
    label: "Gapless sequential serials",
    group: "process",
    standard: "Bank reconciliation control",
    description:
      "Serial numbers advance without gaps, are unique per account, and match the printed Auxiliary On-Us / On-Us encoding.",
    onBack: false,
  },
  {
    id: "positive_pay",
    label: "Positive Pay issue file",
    group: "process",
    standard: "Bank positive pay service",
    description:
      "Export the issued-check file (serial, amount, payee, date) so the drawee bank rejects anything not on the list.",
    onBack: false,
  },
  {
    id: "audit_trail",
    label: "Tamper-evident audit trail",
    group: "process",
    standard: "Internal control",
    description:
      "Every create/print/void transition is written to an append-only audit table with a timestamp.",
    onBack: false,
  },
  {
    id: "ird_compatible",
    label: "IRD / image-friendly contrast",
    group: "process",
    standard: "ANSI X9.100-181 (IRD)",
    description:
      "High-contrast black on white, no reverse type, no screens behind the payee or MICR, so the item survives truncation and image exchange.",
    onBack: true,
  },
];

export const FEATURE_IDS = SECURITY_FEATURES.map((f) => f.id);

/** The two stale-date notices are mutually exclusive — only one prints. */
export const VOID_FEATURE_IDS = ["void_90_days", "void_180_days"];

/** Dedupe + collapse paired features so exactly one void notice is active. */
export function normalizeFeatures(ids: string[]): string[] {
  const out: string[] = [];
  let voidTaken = false;
  for (const id of ids) {
    if (VOID_FEATURE_IDS.includes(id)) {
      if (voidTaken) continue;
      voidTaken = true;
      out.push(id);
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** The baseline set a drawee bank expects on a business check. */
export const BASELINE_FEATURES = [
  "micr_e13b",
  "clear_band",
  "padlock",
  "microprint",
  "watermark",
  "prismatic",
  "warning_band",
  "legal_amount_guard",
  "sequential_serial",
  "ird_compatible",
];

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(
  SECURITY_FEATURES.map((f) => [f.id, f.label]),
);

export type CheckStatus = "pass" | "warn" | "fail";

export type ComplianceCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  standard: string;
};

export type ComplianceInput = {
  routingNumber: string;
  accountNumber: string;
  checkNumber: string;
  amountCents: number;
  dateIssued: string;
  payeeName: string;
  layout: LayoutId;
  features: string[];
  signatureMode: string;
  onUsFormat: OnUsFormat;
  includeAmountField: boolean;
  duplicateSerial?: boolean;
  pastSerials?: number[];
};

export type ComplianceResult = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  checks: ComplianceCheck[];
  blockers: number;
  warnings: number;
  micrText: string;
  micrErrors: string[];
  micrWarnings: string[];
};

const MAX_STALE_DAYS = 180;

export function evaluateCompliance(input: ComplianceInput): ComplianceResult {
  const checks: ComplianceCheck[] = [];
  const layout = getLayout(input.layout) ?? LAYOUTS.wallet;

  // --- MICR geometry -------------------------------------------------------
  const micr = layoutMicr({
    checkWidthIn: layout.width,
    routingNumber: input.routingNumber,
    accountNumber: input.accountNumber,
    checkNumber: input.checkNumber,
    onUsFormat: input.onUsFormat,
    auxOnUs: layout.supportsAuxOnUs,
    includeAmount: input.includeAmountField,
    amountCents: input.amountCents,
  });

  const routingDigits = input.routingNumber.replace(/[^0-9]/g, "");
  checks.push({
    id: "routing_format",
    label: "Routing number is 9 digits",
    status: routingDigits.length === 9 ? "pass" : "fail",
    detail:
      routingDigits.length === 9
        ? "Transit field carries a full 9-digit routing number bracketed by transit symbols."
        : `Got ${routingDigits.length} digits. The Transit field (positions 33-43) requires exactly 9.`,
    standard: "ABA / ANSI X9.6",
  });
  checks.push({
    id: "routing_checksum",
    label: "ABA mod-10 check digit valid",
    status: isRoutingValid(routingDigits) ? "pass" : "fail",
    detail: isRoutingValid(routingDigits)
      ? "3·(1,4,7) + 7·(2,5,8) + 1·(3,6,9) ≡ 0 (mod 10)."
      : "The check digit does not match the first eight digits — sorters will reject the item as a read error.",
    standard: "ABA mod-10",
  });

  const accountDigits = input.accountNumber.replace(/[^0-9]/g, "");
  // Only the On-Us field (positions 13-32) counts toward the 18-position limit;
  // the Auxiliary On-Us serial and the Transit field live in their own fields.
  const onUsLength = micr.chars.filter((c) => c.field === "onUs").length;
  checks.push({
    id: "account_format",
    label: "Account number format",
    status: accountDigits.length >= 4 && accountDigits.length <= 17 ? "pass" : "warn",
    detail: `${accountDigits.length} digits. The On-Us field holds ${ON_US_MAX} usable positions; use the exact string your bank specifies.`,
    standard: "ANSI X9.6 On-Us field",
  });

  checks.push({
    id: "on_us_fit",
    label: "On-Us field fits positions 13-32",
    status: onUsLength === 0 ? "fail" : onUsLength <= ON_US_MAX ? "pass" : "fail",
    detail:
      onUsLength === 0
        ? "The On-Us field is empty — account number required."
        : `Encoded On-Us payload occupies ${onUsLength} of ${ON_US_MAX} available positions.`,
    standard: "ANSI X9.6",
  });

  checks.push({
    id: "clear_band",
    label: "MICR clear band free of other ink",
    status: input.features.includes("clear_band") ? "pass" : "fail",
    detail: input.features.includes("clear_band")
      ? `Background stock and microprint are clipped ${layout.height - 0.625 > 0 ? (layout.height - 0.625).toFixed(3) : "0"}" above the band.`
      : "Background art is running through the 5/8\" clear band — this is the #1 reason homemade checks are rejected.",
    standard: "ANSI X9.100-160-1",
  });

  checks.push({
    id: "aux_on_us",
    label: "Serial placed in the correct field",
    status: "pass",
    detail: layout.supportsAuxOnUs
      ? "Document is longer than 6½\", so the serial is encoded in the Auxiliary On-Us field (positions 45-58) and the account ends with an On-Us symbol."
      : "6-inch document: the Auxiliary On-Us field is not available, so the serial rides at the end of the On-Us field.",
    standard: "ANSI X9.6 §Aux On-Us",
  });

  // --- Negotiable instrument content --------------------------------------
  checks.push({
    id: "amount",
    label: "Amount is positive and within field capacity",
    status:
      input.amountCents > 0 && input.amountCents <= 99_999_999
        ? "pass"
        : input.amountCents > 99_999_999
          ? "warn"
          : "fail",
    detail:
      input.amountCents <= 0
        ? "A check must carry a stated sum certain."
        : input.amountCents > 99_999_999
          ? "Exceeds the Amount field's 8-digit dollar capacity ($999,999.99) — the courtesy box overflows the pre-encoded field tolerance."
          : "Legal amount and courtesy amount are both printed and reconciled.",
    standard: "UCC 3-104 (sum certain)",
  });

  checks.push({
    id: "legal_amount",
    label: "Legal amount in words, asterisk-filled",
    status: input.features.includes("legal_amount_guard") ? "pass" : "warn",
    detail: input.features.includes("legal_amount_guard")
      ? "Words control over numerals; the line is closed with asterisks so it cannot be extended."
      : "Without the asterisk guard the word line can be continued after the fact.",
    standard: "UCC 3-114",
  });

  const payee = input.payeeName.trim();
  checks.push({
    id: "payee",
    label: "Identified payee",
    status: payee.length >= 2 ? (/^(cash|bearer|self)$/i.test(payee) ? "warn" : "pass") : "fail",
    detail:
      payee.length < 2
        ? "The instrument must name a payee (or be payable to bearer)."
        : /^(cash|bearer|self)$/i.test(payee)
          ? "Payable to cash/bearer — negotiable by anyone and a fraud magnet."
          : "Payee named on the face of the instrument.",
    standard: "UCC 3-110",
  });

  const issued = new Date(`${input.dateIssued}T12:00:00`);
  const days = Number.isNaN(issued.getTime())
    ? NaN
    : Math.round((Date.now() - issued.getTime()) / 86_400_000);
  checks.push({
    id: "date",
    label: "Date present, not stale-dated or post-dated",
    status: Number.isNaN(days) ? "fail" : days > MAX_STALE_DAYS ? "warn" : days < -1 ? "warn" : "pass",
    detail: Number.isNaN(days)
      ? "A valid issue date is required."
      : days > MAX_STALE_DAYS
        ? `Issued ${days} days ago — banks may refuse an item stale-dated more than ${MAX_STALE_DAYS} days.`
        : days < -1
          ? `Post-dated ${Math.abs(days)} days into the future; the drawee bank may pay it on presentation anyway.`
          : `Issued ${days >= 0 ? `${days} day(s) ago` : "today"}.`,
    standard: "UCC 3-304 / CC 4-401",
  });

  const serial = input.checkNumber.replace(/[^0-9]/g, "");
  checks.push({
    id: "serial",
    label: "Serial number valid & unique",
    status:
      serial.length >= 3 && serial.length <= 6 && !input.duplicateSerial ? "pass" : "warn",
    detail: `Serial ${serial || "—"}${input.duplicateSerial ? " is already used on this account" : ""}. MICR-encoded serial must match the printed corner serial.`,
    standard: "Bank reconciliation",
  });

  checks.push({
    id: "signature",
    label: "Authorized signature present",
    status: input.signatureMode === "none" ? "fail" : "pass",
    detail:
      input.signatureMode === "none"
        ? "An unissued check is not payable — do not print without a signature block."
        : input.signatureMode === "image"
          ? "Facsimile signature image applied to the signature rule."
          : "Authorized signer facsimile applied to the signature rule.",
    standard: "UCC 3-401",
  });

  checks.push({
    id: "fraction",
    label: "Fractional transit number printed",
    status: input.features.includes("fraction") ? "pass" : "warn",
    detail: input.features.includes("fraction")
      ? "Manual-sort fallback fraction printed in the top-right corner (operator-typed value)."
      : "Optional — type a fractional transit number on the account and enable this feature if your bank wants a manual-sort fallback.",
    standard: "ABA",
  });

  // --- Anti-counterfeit stack ---------------------------------------------
  const missingBaseline = BASELINE_FEATURES.filter((f) => !input.features.includes(f));
  const antiCopy = ["microprint", "watermark", "prismatic"].filter((f) =>
    input.features.includes(f),
  ).length;
  checks.push({
    id: "anti_copy",
    label: "Anti-copy deterrents (need ≥ 2)",
    status: antiCopy >= 2 ? "pass" : antiCopy >= 1 ? "warn" : "fail",
    detail: `${antiCopy}/3 copy-defeating features enabled (microprint, guilloche engraved background, prismatic screen).`,
    standard: "Check Fraud Prevention (ABA)",
  });

  const forensic = ["chem_reactive", "thermochromic", "uv_fibers", "erasure_guard"].filter((f) =>
    input.features.includes(f),
  ).length;
  checks.push({
    id: "forensic",
    label: "Forensic / tamper-evident chemistry (need ≥ 2)",
    status: forensic >= 2 ? "pass" : forensic >= 1 ? "warn" : "fail",
    detail: `${forensic}/4 tamper-evident features enabled (chemical reactive, thermochromic, UV fibres, erasure guard).`,
    standard: "Check Fraud Prevention (ABA)",
  });

  checks.push({
    id: "disclosure",
    label: "Padlock icon + rear disclosure box",
    status:
      input.features.includes("padlock") && input.features.includes("warning_band")
        ? "pass"
        : "fail",
    detail:
      "The accepting bank needs the padlock icon and the rear box that enumerates the security features so they know what to verify.",
    standard: "ABA padlock icon program",
  });

  checks.push({
    id: "image_exchange",
    label: "Truncation / image-exchange ready",
    status: input.features.includes("ird_compatible") ? "pass" : "warn",
    detail: input.features.includes("ird_compatible")
      ? "Black on white, no reverse type, no screen behind the payee or MICR band."
      : "Reverse type and screens destroy legibility when the item is imaged at 200 dpi.",
    standard: "ANSI X9.100-181",
  });

  checks.push({
    id: "positive_pay",
    label: "Positive Pay file issued to drawee bank",
    status: input.features.includes("positive_pay") ? "pass" : "warn",
    detail: input.features.includes("positive_pay")
      ? "Export the issue file after printing and transmit it to the bank."
      : "Without Positive Pay, counterfeit items against your account will clear.",
    standard: "Bank positive pay service",
  });

  // --- Hardware reality check --------------------------------------------
  checks.push({
    id: "magnetic_ink",
    label: "Magnetic (iron-oxide) toner or ink",
    status: "warn",
    detail:
      "Software cannot verify your printer. Sorters read magnetically — print on a laser printer with MICR toner (or on pre-printed MICR check stock) and confirm with a position gauge.",
    standard: "ANSI X9.27 signal level",
  });
  checks.push({
    id: "stock",
    label: "24 lb+ security check stock, 100% scale",
    status: "warn",
    detail:
      "Print at Actual Size / 100% (never \"Fit to page\") on 24 lb bond or dedicated blank check stock. Verify the MICR baseline lands 3/16\" from the trim edge with an E-13B gauge.",
    standard: "ANSI X9.13 / CPA 006",
  });

  const blockers = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const weight = checks.reduce((acc, c) => {
    const w = c.status === "pass" ? 1 : c.status === "warn" ? 0.6 : 0;
    return acc + w;
  }, 0);
  const score = Math.round((weight / checks.length) * 100);
  const grade = score >= 92 ? "A" : score >= 82 ? "B" : score >= 68 ? "C" : "D";

  const dupes = missingBaseline.length
    ? `${missingBaseline.length} baseline feature(s) disabled: ${missingBaseline
        .map((f) => FEATURE_LABELS[f] ?? f)
        .join(", ")}`
    : "";

  return {
    score,
    grade,
    checks,
    blockers,
    warnings,
    micrText: micr.text,
    micrErrors: [...micr.errors],
    micrWarnings: [...micr.warnings, ...(dupes ? [dupes] : [])],
  };
}

/**
 * Allowed status transitions. `printed`/`issued` are the live states; money
 * states (cleared) and dead states (void, stopped) do not resurrect.
 */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["printed", "issued", "void"],
  printed: ["issued", "cleared", "void", "stopped"],
  issued: ["printed", "cleared", "stopped", "void"],
  cleared: ["stopped"],
  void: [],
  stopped: ["void"],
};

export const ALL_STATUSES = ["draft", "printed", "issued", "cleared", "void", "stopped"] as const;

export function nextStatuses(current: string): string[] {
  return STATUS_TRANSITIONS[current] ?? [];
}
