/**
 * Printable background stock library — security tints and engraved lattices
 * split into business and personal families. Every entry is clipped above the
 * 5/8" MICR clear band so the decoration can never raise the signal floor of
 * the line. All colours are low-contrast pastels tuned to drop out of 200 dpi
 * black-and-white image exchange (ANSI X9.100-181).
 */
export type BackgroundGroup = "business" | "personal";

export type PatternKind =
  | "guilloche"
  | "rosettes"
  | "dots"
  | "grid"
  | "pinstripe"
  | "weave"
  | "waves"
  | "rings"
  | "flourish"
  | "none";

export type BackgroundDef = {
  id: string;
  name: string;
  group: BackgroundGroup;
  hint: string;
  /** CSS background applied to the area above the clear band */
  base: string;
  pattern: PatternKind;
  /** stroke/ink colour for the pattern layer */
  ink?: string;
  /** swatch for the picker */
  swatch: string;
  /** printed completely blank — plain laser blank check stock */
  blank?: boolean;
};

export const BACKGROUNDS: BackgroundDef[] = [
  {
    id: "plain",
    name: "Plain white",
    group: "business",
    hint: "Untinted 24 lb blank check stock — maximum contrast, best possible image-exchange legibility.",
    base: "#ffffff",
    pattern: "none",
    swatch: "linear-gradient(135deg,#ffffff,#ffffff)",
    blank: true,
  },

  /* ---------------- business: formal, engraved, anti-copy --------------- */
  {
    id: "biz-prismatic",
    name: "Prismatic two-tone",
    group: "business",
    hint: "The classic two-tone security screen used on commercial check stock.",
    base: "linear-gradient(112deg,#eef3f9 0%,#f6f6f2 44%,#e9f0f5 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#eef3f9,#cfdcea)",
  },
  {
    id: "biz-navy",
    name: "Navy",
    group: "business",
    hint: "Deep navy band tint — reads as a corporate disbursement check.",
    base: "linear-gradient(160deg,#eef2f9 0%,#e6ecf6 55%,#dde5f2 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#eef2f9,#c3d1e8)",
  },
  {
    id: "biz-charcoal",
    name: "Charcoal",
    group: "business",
    hint: "Neutral grey security screen — the most scanner-proof of the flat tints.",
    base: "linear-gradient(160deg,#f0f1f3 0%,#e8eaee 55%,#e2e5ea 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#f0f1f3,#ccd2da)",
  },
  {
    id: "biz-steel",
    name: "Steel blue",
    group: "business",
    hint: "Cool steel-blue tint with a subtle vertical fall-off.",
    base: "linear-gradient(180deg,#eef4f8 0%,#e7eef5 60%,#eff4f8 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#eef4f8,#c6d7e5)",
  },
  {
    id: "biz-forest",
    name: "Corporate forest",
    group: "business",
    hint: "Deep corporate green — traditional payroll and disbursement stock.",
    base: "linear-gradient(160deg,#ecf3ed 0%,#e3eee7 55%,#dbe9e0 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#ecf3ed,#c2d8c9)",
  },
  {
    id: "biz-burgundy",
    name: "Burgundy",
    group: "business",
    hint: "Muted burgundy tint for trust and attorney escrow accounts.",
    base: "linear-gradient(160deg,#f7eff0 0%,#f1e5e7 55%,#ebdcdf 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#f7eff0,#e0c8cd)",
  },
  {
    id: "biz-slate-amber",
    name: "Ledger slate",
    group: "business",
    hint: "Warm accounting-ledger tint with a slate fall-off.",
    base: "linear-gradient(135deg,#f4f1ea 0%,#eef0f2 55%,#e7ebef 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#f4f1ea,#d5dbe2)",
  },
  {
    id: "biz-guilloche-navy",
    name: "Guilloche · navy",
    group: "business",
    hint: "Banknote-style hairline wave lattice on navy. Copiers flatten it into a solid band.",
    base: "linear-gradient(112deg,#eef3f9 0%,#f6f6f2 50%,#e9f0f5 100%)",
    pattern: "guilloche",
    ink: "#b4c8de",
    swatch: "repeating-linear-gradient(45deg,#eef3f9 0 3px,#c6d6e8 3px 4px)",
  },
  {
    id: "biz-guilloche-forest",
    name: "Guilloche · forest",
    group: "business",
    hint: "Hairline engraved lattice on a corporate green tint.",
    base: "linear-gradient(112deg,#ecf3ed 0%,#f4f7f2 50%,#e3eee7 100%)",
    pattern: "guilloche",
    ink: "#b0cfba",
    swatch: "repeating-linear-gradient(45deg,#ecf3ed 0 3px,#c7dccd 3px 4px)",
  },
  {
    id: "biz-guilloche-burgundy",
    name: "Guilloche · burgundy",
    group: "business",
    hint: "Hairline engraved lattice on a burgundy tint.",
    base: "linear-gradient(112deg,#f7eff0 0%,#f9f5f4 50%,#f1e5e7 100%)",
    pattern: "guilloche",
    ink: "#d3b3ba",
    swatch: "repeating-linear-gradient(45deg,#f7eff0 0 3px,#e6cdd2 3px 4px)",
  },
  {
    id: "biz-guilloche-charcoal",
    name: "Guilloche · charcoal",
    group: "business",
    hint: "Hairline engraved lattice on charcoal grey.",
    base: "linear-gradient(112deg,#f0f1f3 0%,#f7f7f8 50%,#e8eaee 100%)",
    pattern: "guilloche",
    ink: "#b9c0c9",
    swatch: "repeating-linear-gradient(45deg,#f0f1f3 0 3px,#ced4dc 3px 4px)",
  },
  {
    id: "biz-rosette-navy",
    name: "Rosette engraving · navy",
    group: "business",
    hint: "Banknote rosette medallions — the strongest visual deterrent against color-copy counterfeits.",
    base: "linear-gradient(112deg,#edf2f9 0%,#f7f8fa 50%,#e8eef6 100%)",
    pattern: "rosettes",
    ink: "#a9bfda",
    swatch: "radial-gradient(circle at 50% 50%,#f1f5fa 0 30%,#b8cbe3 31% 42%,#f1f5fa 43%) 0 0/22px 22px,#f1f5fa",
  },
  {
    id: "biz-rosette-forest",
    name: "Rosette engraving · forest",
    group: "business",
    hint: "Rosette medallion engraving on corporate green — trust-company styling.",
    base: "linear-gradient(112deg,#ecf3ee 0%,#f6f8f4 50%,#e4efe8 100%)",
    pattern: "rosettes",
    ink: "#a6c7b2",
    swatch: "radial-gradient(circle at 50% 50%,#f2f7f3 0 30%,#bcd7c4 31% 42%,#f2f7f3 43%) 0 0/22px 22px,#f2f7f3",
  },
  {
    id: "biz-rosette-slate",
    name: "Rosette engraving · slate",
    group: "business",
    hint: "Understated rosette engraving on grey — photocopier moiré guarantee.",
    base: "linear-gradient(112deg,#eff1f4 0%,#f8f9fa 50%,#e9ecef 100%)",
    pattern: "rosettes",
    ink: "#adbac7",
    swatch: "radial-gradient(circle at 50% 50%,#f4f6f8 0 30%,#c3ccd6 31% 42%,#f4f6f8 43%) 0 0/22px 22px,#f4f6f8",
  },
  {
    id: "biz-pinstripe-navy",
    name: "Pinstripe · navy",
    group: "business",
    hint: "Mohair-hairline vertical stripes — reveals cut-and-paste alteration instantly.",
    base: "linear-gradient(180deg,#eef2f8 0%,#f4f7fb 100%)",
    pattern: "pinstripe",
    ink: "#c3d1e2",
    swatch: "repeating-linear-gradient(90deg,#eef2f8 0 5px,#c3d1e2 5px 6px)",
  },
  {
    id: "biz-pinstripe-green",
    name: "Pinstripe · banker green",
    group: "business",
    hint: "Traditional banker-green pinstripe screen.",
    base: "linear-gradient(180deg,#edf4ef 0%,#f4f8f5 100%)",
    pattern: "pinstripe",
    ink: "#c4dbcd",
    swatch: "repeating-linear-gradient(90deg,#edf4ef 0 5px,#c4dbcd 5px 6px)",
  },
  {
    id: "biz-weave-navy",
    name: "Security weave · navy",
    group: "business",
    hint: "Crosshatched security weave — the light-risk pattern used on certificate paper.",
    base: "linear-gradient(135deg,#eef2f8 0%,#f5f8fb 50%,#e9eff7 100%)",
    pattern: "weave",
    ink: "#bfd1e4",
    swatch: "repeating-linear-gradient(45deg,#eef2f8 0 3px,#c7d5e6 3px 4px),repeating-linear-gradient(-45deg,#eef2f8 0 3px,#c7d5e6 3px 4px)",
  },
  {
    id: "biz-halo",
    name: "Corporate halo",
    group: "business",
    hint: "Radial vignette centred on the payee block; drops out of black-and-white scanning.",
    base: "radial-gradient(120% 135% at 28% 18%,#fcfdfe 0%,#f1f4f8 55%,#e4eaf1 100%)",
    pattern: "none",
    swatch: "radial-gradient(circle at 30% 30%,#fcfdfe,#dfe6ef)",
  },
  {
    id: "biz-doves",
    name: "Flourish · stone",
    group: "business",
    hint: "Engraved flourish bands — classical engraved stock for escrow and legal.",
    base: "linear-gradient(112deg,#f2f1ed 0%,#faf9f6 50%,#ecebe5 100%)",
    pattern: "flourish",
    ink: "#d5d2c4",
    swatch: "repeating-linear-gradient(0deg,#f4f3ef 0 4px,#ddd9c9 4px 5px)",
  },
  {
    id: "biz-dots",
    name: "Halftone microdot",
    group: "business",
    hint: "Microdot halftone field — screens out predictably and shows copy generation loss.",
    base: "linear-gradient(180deg,#f4f6f9 0%,#eef1f5 100%)",
    pattern: "dots",
    ink: "#c2cbd7",
    swatch: "radial-gradient(#c2cbd7 26%,transparent 27%) 0 0/5px 5px,linear-gradient(#f4f6f9,#eef1f5)",
  },
  {
    id: "biz-grid",
    name: "Fine rule grid",
    group: "business",
    hint: "Engineering-style fine rule grid — instantly reveals cut-and-paste alteration.",
    base: "linear-gradient(180deg,#f5f6f8 0%,#eef0f3 100%)",
    pattern: "grid",
    ink: "#c9d0da",
    swatch: "linear-gradient(#c9d0da 1px,transparent 1px) 0 0/5px 5px,linear-gradient(90deg,#c9d0da 1px,transparent 1px) 0 0/5px 5px,#f5f6f8",
  },

  /* ---------------- personal: softer, decorative, still safe -------------- */
  {
    id: "per-sky",
    name: "Sky",
    group: "personal",
    hint: "Soft sky tint — the standard consumer check stock.",
    base: "linear-gradient(112deg,#eaf2fb 0%,#f4f7fb 42%,#e9f1f6 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#eaf2fb,#cfe0f2)",
  },
  {
    id: "per-sage",
    name: "Sage",
    group: "personal",
    hint: "Green ledger tint.",
    base: "linear-gradient(112deg,#eaf3ec 0%,#f3f7f1 45%,#e6f0e9 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#eaf3ec,#cde3d3)",
  },
  {
    id: "per-linen",
    name: "Linen",
    group: "personal",
    hint: "Warm parchment / linen stock.",
    base: "linear-gradient(112deg,#faf5ea 0%,#f8f4ec 50%,#f4eddd 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#faf5ea,#eadfc4)",
  },
  {
    id: "per-mint",
    name: "Mint",
    group: "personal",
    hint: "Fresh mint tint.",
    base: "linear-gradient(112deg,#e9f6f2 0%,#f2f9f6 45%,#e2f2ec 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#e9f6f2,#c6e6db)",
  },
  {
    id: "per-blush",
    name: "Blush",
    group: "personal",
    hint: "Warm blush tint used on many personal and payroll stocks.",
    base: "linear-gradient(112deg,#fbeeef 0%,#fdf5f5 45%,#f7e8ea 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#fbeeef,#f2d4d9)",
  },
  {
    id: "per-lilac",
    name: "Lilac",
    group: "personal",
    hint: "Soft lilac tint.",
    base: "linear-gradient(112deg,#f0effa 0%,#f6f5fb 45%,#eae8f7 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#f0effa,#d8d6f0)",
  },
  {
    id: "per-peach",
    name: "Peach",
    group: "personal",
    hint: "Warm peach tint.",
    base: "linear-gradient(112deg,#fdf1ea 0%,#fdf7f2 45%,#fae7dc 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#fdf1ea,#f4d6c2)",
  },
  {
    id: "per-seashell",
    name: "Seashell",
    group: "personal",
    hint: "Neutral warm off-white with a pearl sheen.",
    base: "linear-gradient(112deg,#fbfaf7 0%,#fdfcf9 45%,#f6f3ec 100%)",
    pattern: "none",
    swatch: "linear-gradient(135deg,#fbfaf7,#e9e4d8)",
  },
  {
    id: "per-guilloche-sky",
    name: "Guilloche · sky",
    group: "personal",
    hint: "Hairline engraved lattice on a sky tint.",
    base: "linear-gradient(112deg,#eaf2fb 0%,#f4f7fb 50%,#e9f1f6 100%)",
    pattern: "guilloche",
    ink: "#b9cfe4",
    swatch: "repeating-linear-gradient(45deg,#eaf2fb 0 3px,#c9dbec 3px 4px)",
  },
  {
    id: "per-guilloche-linen",
    name: "Guilloche · linen",
    group: "personal",
    hint: "Hairline engraved lattice on parchment.",
    base: "linear-gradient(112deg,#faf5ea 0%,#f8f4ec 50%,#f4eddd 100%)",
    pattern: "guilloche",
    ink: "#d9c9a4",
    swatch: "repeating-linear-gradient(45deg,#faf5ea 0 3px,#e6d9b6 3px 4px)",
  },
  {
    id: "per-guilloche-rose",
    name: "Guilloche · rose",
    group: "personal",
    hint: "Hairline engraved lattice on a rose tint.",
    base: "linear-gradient(112deg,#fbeeef 0%,#fdf5f5 50%,#f7e8ea 100%)",
    pattern: "guilloche",
    ink: "#e2bcc3",
    swatch: "repeating-linear-gradient(45deg,#fbeeef 0 3px,#f0d0d6 3px 4px)",
  },
  {
    id: "per-guilloche-sage",
    name: "Guilloche · sage",
    group: "personal",
    hint: "Hairline engraved lattice on a sage tint.",
    base: "linear-gradient(112deg,#eaf3ec 0%,#f3f7f1 50%,#e6f0e9 100%)",
    pattern: "guilloche",
    ink: "#b5d2bd",
    swatch: "repeating-linear-gradient(45deg,#eaf3ec 0 3px,#cbe2d2 3px 4px)",
  },
  {
    id: "per-rosette-dawn",
    name: "Rosette · dawn",
    group: "personal",
    hint: "Soft engraved medallions on a dawn tint — decorative but copy-hostile.",
    base: "linear-gradient(112deg,#fdf3ef 0%,#fefaf7 50%,#faeae2 100%)",
    pattern: "rosettes",
    ink: "#ebcbbd",
    swatch: "radial-gradient(circle at 50% 50%,#fef6f2 0 30%,#f2d5c8 31% 42%,#fef6f2 43%) 0 0/22px 22px,#fef6f2",
  },
  {
    id: "per-rosette-lilac",
    name: "Rosette · lilac",
    group: "personal",
    hint: "Soft engraved medallions on lilac.",
    base: "linear-gradient(112deg,#f1f0fa 0%,#f8f7fd 50%,#eae8f7 100%)",
    pattern: "rosettes",
    ink: "#cfcbe8",
    swatch: "radial-gradient(circle at 50% 50%,#f6f5fc 0 30%,#d7d3ec 31% 42%,#f6f5fc 43%) 0 0/22px 22px,#f6f5fc",
  },
  {
    id: "per-waves-ocean",
    name: "Waves · ocean",
    group: "personal",
    hint: "Fine engraved waves — popular on coastal credit-union personal stock.",
    base: "linear-gradient(160deg,#ebf4f9 0%,#f5fafc 50%,#e6f1f6 100%)",
    pattern: "waves",
    ink: "#bcd7e4",
    swatch: "repeating-linear-gradient(0deg,#eff6fa 0 4px,#cbe0ea 4px 5px)",
  },
  {
    id: "per-waves-sunrise",
    name: "Waves · sunrise",
    group: "personal",
    hint: "Engraved wave bands on a warm sunrise tint.",
    base: "linear-gradient(160deg,#fdf4ec 0%,#fefaf5 50%,#fbeee3 100%)",
    pattern: "waves",
    ink: "#eed3bd",
    swatch: "repeating-linear-gradient(0deg,#fef6ee 0 4px,#f2ddca 4px 5px)",
  },
  {
    id: "per-rings-pearl",
    name: "Rings · pearl",
    group: "personal",
    hint: "Concentric engraved rings on a pearl tint — a guilloche lathe pattern.",
    base: "linear-gradient(135deg,#f7f6f2 0%,#fcfbf8 45%,#f1efe7 100%)",
    pattern: "rings",
    ink: "#dcd6c4",
    swatch: "repeating-radial-gradient(circle at 30% 30%,#faf9f5 0 3px,#e2dcc9 3px 4px)",
  },
  {
    id: "per-rings-sky",
    name: "Rings · sky",
    group: "personal",
    hint: "Concentric engraved rings on a soft sky tint.",
    base: "linear-gradient(135deg,#edf4fa 0%,#f8fbfd 45%,#e7f0f7 100%)",
    pattern: "rings",
    ink: "#c8dcea",
    swatch: "repeating-radial-gradient(circle at 30% 30%,#f5f9fc 0 3px,#d3e3ef 3px 4px)",
  },
  {
    id: "per-pinstripe-parchment",
    name: "Pinstripe · parchment",
    group: "personal",
    hint: "Fine vertical hairlines on parchment — a classic personal check weave.",
    base: "linear-gradient(180deg,#faf6ec 0%,#f6f1e3 100%)",
    pattern: "pinstripe",
    ink: "#e0d3b2",
    swatch: "repeating-linear-gradient(90deg,#faf6ec 0 5px,#e0d3b2 5px 6px)",
  },
  {
    id: "per-weave-sage",
    name: "Security weave · sage",
    group: "personal",
    hint: "Crosshatched security weave on sage.",
    base: "linear-gradient(135deg,#ecf3ee 0%,#f5f9f5 50%,#e5efe8 100%)",
    pattern: "weave",
    ink: "#c2d8cb",
    swatch: "repeating-linear-gradient(45deg,#ecf3ee 0 3px,#cfe2d5 3px 4px),repeating-linear-gradient(-45deg,#ecf3ee 0 3px,#cfe2d5 3px 4px)",
  },
  {
    id: "per-dots",
    name: "Halftone dots",
    group: "personal",
    hint: "Microdot halftone field on a soft sky tint.",
    base: "linear-gradient(180deg,#f5f8fb 0%,#eef3f8 100%)",
    pattern: "dots",
    ink: "#c8d6e4",
    swatch: "radial-gradient(#c8d6e4 26%,transparent 27%) 0 0/5px 5px,linear-gradient(#f5f8fb,#eef3f8)",
  },
  {
    id: "per-grid",
    name: "Fine rule grid",
    group: "personal",
    hint: "Fine rule grid on a warm tint.",
    base: "linear-gradient(180deg,#faf8f4 0%,#f5f2ea 100%)",
    pattern: "grid",
    ink: "#ddd4bf",
    swatch: "linear-gradient(#ddd4bf 1px,transparent 1px) 0 0/5px 5px,linear-gradient(90deg,#ddd4bf 1px,transparent 1px) 0 0/5px 5px,#faf8f4",
  },
  {
    id: "per-halo",
    name: "Soft halo",
    group: "personal",
    hint: "Gentle radial vignette that keeps the payee block the lightest area on the page.",
    base: "radial-gradient(125% 140% at 30% 22%,#fefefe 0%,#f6f8fa 55%,#eaeff4 100%)",
    pattern: "none",
    swatch: "radial-gradient(circle at 30% 30%,#fefefe,#e6ebf1)",
  },
];

/** Older ids → current stock, so saved checks keep their look. */
const ALIASES: Record<string, string> = {
  sky: "per-sky",
  sage: "per-sage",
  linen: "per-linen",
  slate: "biz-charcoal",
  rose: "per-blush",
  indigo: "per-lilac",
  turquoise: "per-mint",
  "guilloche-sky": "per-guilloche-sky",
  "guilloche-sage": "per-guilloche-sage",
  "guilloche-linen": "per-guilloche-linen",
  "biz-guilloche": "biz-guilloche-navy",
  halo: "per-halo",
};

export function getBackground(id: string | null | undefined): BackgroundDef {
  const key = id && ALIASES[id] ? ALIASES[id] : id;
  return BACKGROUNDS.find((b) => b.id === key) ?? BACKGROUNDS[1];
}

export function backgroundsFor(group: BackgroundGroup) {
  return BACKGROUNDS.filter((b) => b.group === group);
}
