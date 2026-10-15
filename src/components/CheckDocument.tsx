import type { CSSProperties, ReactNode } from "react";
import {
  MICR_BASELINE,
  MICR_CHAR_HEIGHT,
  MICR_GLYPHS,
  MICR_LEADING_EDGE,
  MICR_PITCH,
  layoutMicr,
  micrRuns,
  type OnUsFormat,
} from "@/lib/micr";
import { getBackground, type BackgroundDef } from "@/lib/backgrounds";
import { formatAddressBlock, formatCents, formatDate, legalAmount } from "@/lib/amount";
import { LAYOUTS, getLayout, type LayoutId, type LayoutSpec } from "@/lib/layouts";

/** Height of the E-13B character cell in design units (digits full height). */
const MICR_GLYPH_MAX_H = Math.max(...Object.values(MICR_GLYPHS).map((g) => g.h));

export type CheckAccountView = {
  holderName: string;
  holderAddress: string;
  holderPhone: string;
  bankName: string;
  bankAddress: string;
  routingNumber: string;
  accountNumber: string;
  fraction: string;
  onUsFormat: string;
  /** bank logo (top-centre) — added/removed/resized on the account */
  logoDataUrl: string | null;
  bankLogoWidthIn: number;
  /** drawer / company logo (top-left, above the holder block) */
  companyLogoDataUrl: string | null;
  companyLogoWidthIn: number;
  signatureDataUrl: string | null;
  signatureText: string;
  signatureTitle: string;
  accountClass: string;
  background: string;
  micrRenderer: string;
  micrFontDataUrl: string | null;
  micrFontSizePt: number;
};

export type CheckView = {
  checkNumber: number;
  payeeName: string;
  payeeAddress: string;
  amountCents: number;
  dateIssued: string;
  memo: string;
  signatureMode: string;
  features: string[];
  includeAmountField: boolean;
  status?: string;
  background?: string;
};

const IN = (v: number) => `${v}in`;

/**
 * Strict client-side re-validation of the custom font data URL. The server
 * already rejects anything else (see src/lib/datasafe.ts); this keeps a stale
 * or tampered row from ever reaching a <style> tag.
 */
const FONT_DATA_URL_RE = /^data:(font\/(ttf|otf|woff2?)|application\/x-font-ttf);base64,[A-Za-z0-9+/=\s]+$/;

function isSafeFontDataUrl(v: string | null | undefined): v is string {
  return typeof v === "string" && v.length <= 2_800_000 && FONT_DATA_URL_RE.test(v);
}

function At({
  x,
  y,
  w,
  align = "left",
  children,
  style,
}: {
  x: number;
  y: number;
  w?: number;
  align?: "left" | "right" | "center";
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: IN(x),
        top: IN(y),
        width: w === undefined ? undefined : IN(w),
        textAlign: align,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Clip helper: keeps decorative ink out of the 5/8" MICR clear band. */
const aboveClearBand = { height: `calc(100% - ${IN(0.625)})` } as const;

/**
 * Pattern layers for the selected stock. All of them are clipped above the
 * 5/8" MICR clear band so decoration can never interfere with the line.
 */
function BackgroundStock({
  bg,
  width,
  height,
  full = false,
}: {
  bg: BackgroundDef;
  width: number;
  height: number;
  /** cover the entire sheet (rear side — no MICR clear band there) */
  full?: boolean;
}) {
  if (bg.blank) return null;
  const layers: ReactNode[] = [];

  // the front stays clipped above the 5/8" clear band; the back covers 100%
  const coverH = full ? "100%" : "calc(100% - 0.625in)";
  const inkH = full ? height : height - 0.625;

  if (bg.base && bg.base !== "#ffffff") {
    layers.push(
      <div
        key="base"
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: coverH,
          background: bg.base,
        }}
      />,
    );
  }

  if (bg.ink) {
    switch (bg.pattern) {
      case "guilloche":
        layers.push(
          <Guilloche key="g" width={width} height={inkH} stroke={bg.ink} />,
        );
        break;
      case "rosettes":
        layers.push(
          <PatternSvg key="ro" width={width} height={inkH} stroke={bg.ink} draw={drawRosettes} />,
        );
        break;
      case "pinstripe":
        layers.push(
          <div
            key="ps"
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: coverH,
              backgroundImage: `repeating-linear-gradient(90deg, transparent 0 4.5px, ${bg.ink} 4.5px 5.5px)`,
            }}
          />,
        );
        break;
      case "weave":
        layers.push(
          <div
            key="wv"
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: coverH,
              backgroundImage: `repeating-linear-gradient(45deg, transparent 0 3px, ${bg.ink} 3px 3.6px), repeating-linear-gradient(-45deg, transparent 0 3px, ${bg.ink} 3px 3.6px)`,
              opacity: 0.75,
            }}
          />,
        );
        break;
      case "waves":
        layers.push(
          <PatternSvg key="wv2" width={width} height={inkH} stroke={bg.ink} draw={drawWaves} />,
        );
        break;
      case "rings":
        layers.push(
          <PatternSvg key="rg" width={width} height={inkH} stroke={bg.ink} draw={drawRings} />,
        );
        break;
      case "flourish":
        layers.push(
          <PatternSvg key="fl" width={width} height={inkH} stroke={bg.ink} draw={drawFlourish} />,
        );
        break;
      case "dots":
        layers.push(
          <div
            key="d"
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: coverH,
              backgroundImage: `radial-gradient(${bg.ink} 30%, transparent 32%)`,
              backgroundSize: "0.048in 0.048in",
            }}
          />,
        );
        break;
      case "grid":
        layers.push(
          <div
            key="gr"
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: coverH,
              backgroundImage: `linear-gradient(${bg.ink} 0.5px, transparent 0.5px), linear-gradient(90deg, ${bg.ink} 0.5px, transparent 0.5px)`,
              backgroundSize: "0.09in 0.09in",
            }}
          />,
        );
        break;
      default:
        break;
    }
  }
  return <>{layers}</>;
}

/** Hairline SVG pattern layer — explicit inches-sized box, no clipping Magic. */
function PatternSvg({
  width,
  height,
  stroke,
  draw,
  opacity = 0.55,
}: {
  width: number;
  height: number;
  stroke: string;
  draw: (w: number, h: number, stroke: string) => ReactNode[];
  opacity?: number;
}) {
  const w = width * 96;
  const h = height * 96;
  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: IN(width),
        height: IN(height),
        opacity,
      }}
      viewBox={`0 0 ${w} ${h}`}
    >
      {draw(w, h, stroke)}
    </svg>
  );
}

/* --- Engraved patterns (all hairline: 0.35–0.6 device px) ----------------- */

function drawRosettes(w: number, h: number, stroke: string): ReactNode[] {
  const r = 11;
  const out: ReactNode[] = [];
  let row = 0;
  for (let y = r; y < h + r; y += r * 1.9, row += 1) {
    const offset = row % 2 ? r * 1.9 : 0;
    for (let x = -r + offset; x < w + r; x += r * 3.8) {
      for (let k = 0; k < 4; k += 1) {
        const rr = r * (1 - k * 0.22);
        out.push(
          <circle key={`c${x}-${y}-${k}`} cx={x} cy={y} r={rr} fill="none" stroke={stroke} strokeWidth={0.4} />,
        );
      }
    }
  }
  return out;
}

function drawWaves(w: number, h: number, stroke: string): ReactNode[] {
  const amp = 5;
  const len = 26;
  const out: ReactNode[] = [];
  for (let y = 0; y < h + len; y += len) {
    out.push(
      <path
        key={`w${y}`}
        d={`M0 ${y} q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0 t ${len / 2} 0 t ${len / 2} 0 T ${w + len} ${y}`}
        fill="none"
        stroke={stroke}
        strokeWidth={0.4}
      />,
    );
  }
  return out;
}

function drawRings(w: number, h: number, stroke: string): ReactNode[] {
  const out: ReactNode[] = [];
  const cx = w * 0.25;
  const cy = h * 0.3;
  for (let r = 6; r < w * 0.9; r += 7) {
    out.push(
      <circle key={`r${r}`} cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={0.35} />,
    );
  }
  const cx2 = w * 0.78;
  const cy2 = h * 0.75;
  for (let r = 6; r < w * 0.6; r += 9) {
    out.push(
      <circle key={`r2${r}`} cx={cx2} cy={cy2} r={r} fill="none" stroke={stroke} strokeWidth={0.3} />,
    );
  }
  return out;
}

function drawFlourish(w: number, h: number, stroke: string): ReactNode[] {
  const out: ReactNode[] = [];
  const band = 22;
  for (let y = band / 2; y < h; y += band) {
    out.push(
      <path
        key={`f${y}`}
        d={`M0 ${y} C ${w * 0.12} ${y - 8}, ${w * 0.2} ${y + 8}, ${w * 0.33} ${y} S ${w * 0.55} ${y - 8}, ${w * 0.66} ${y} S ${w * 0.9} ${y + 8}, ${w} ${y}`}
        fill="none"
        stroke={stroke}
        strokeWidth={0.45}
      />,
    );
    out.push(
      <path
        key={`f2${y}`}
        d={`M0 ${y} C ${w * 0.15} ${y + 6}, ${w * 0.3} ${y - 6}, ${w * 0.5} ${y} S ${w * 0.8} ${y + 6}, ${w} ${y - 2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={0.3}
      />,
    );
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* MICR                                                              */
/* ------------------------------------------------------------------ */

export type MicrRenderer = "font" | "vector";

export function MicrLine({
  checkWidthIn,
  routingNumber,
  accountNumber,
  checkNumber,
  onUsFormat,
  auxOnUs,
  includeAmount,
  amountCents,
  tone = "#000",
  renderer = "font",
  fontDataUrl = null,
  fontSizePt = 12,
}: {
  checkWidthIn: number;
  routingNumber: string;
  accountNumber: string;
  checkNumber: string;
  onUsFormat: OnUsFormat;
  auxOnUs: boolean;
  includeAmount?: boolean;
  amountCents?: number;
  tone?: string;
  renderer?: MicrRenderer | string;
  fontDataUrl?: string | null;
  fontSizePt?: number;
}) {
  const micr = layoutMicr({
    checkWidthIn,
    routingNumber,
    accountNumber,
    checkNumber,
    onUsFormat,
    auxOnUs,
    includeAmount,
    amountCents,
  });

  const useVector = renderer === "vector";
  const runs = micrRuns(micr.chars);
  // 96 CSS px per inch keeps SVG user units equal to CSS pixels, so a font-size
  // expressed in points lands on its true physical size.
  const bandH = 0.34;
  const svgW = checkWidthIn * 96;
  const svgH = bandH * 96;
  const customFamily = '"MICR E13B Custom","MICR E13B",monospace';
  const bundledFamily = '"MICR E13B",monospace';

  if (!useVector) {
    const safeFont = isSafeFontDataUrl(fontDataUrl) ? fontDataUrl : null;
    return (
      <>
        {safeFont ? (
          <style
            dangerouslySetInnerHTML={{
              __html: `@font-face{font-family:"MICR E13B Custom";src:url("${safeFont}") format("truetype");font-display:block;}`,
            }}
          />
        ) : null}
        <svg
          width={IN(checkWidthIn)}
          height={IN(bandH)}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{
            position: "absolute",
            left: 0,
            bottom: IN(MICR_BASELINE),
            width: IN(checkWidthIn),
            height: IN(bandH),
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          {runs.map((run, i) => (
            <text
              key={`${run.field}-${i}`}
              x={run.x * 96}
              y={svgH}
              fill={tone}
              style={{
                fontFamily: safeFont ? customFamily : bundledFamily,
                fontSize: `${fontSizePt}pt`,
                letterSpacing: 0,
                whiteSpace: "pre",
              }}
            >
              {run.text}
            </text>
          ))}
        </svg>
      </>
    );
  }

  return (
    <>
      {micr.chars.map((c, i) => {
        const g = MICR_GLYPHS[c.ch];
        if (!g) return null;
        // TRUE E-13B proportions: every glyph shares one scale factor so the
        // printed stroke widths match the ISO 1004 reference (the dash and the
        // On-Us symbol are shorter than the digits — that is the spec, not a bug).
        const scale = MICR_CHAR_HEIGHT / MICR_GLYPH_MAX_H;
        const w = g.w * scale;
        const h = g.h * scale;
        return (
          <svg
            key={`${c.ch}-${i}`}
            viewBox={`0 0 ${g.w} ${g.h}`}
            style={{
              position: "absolute",
              left: IN(c.x + (MICR_PITCH - w) / 2),
              bottom: IN(MICR_BASELINE),
              width: IN(w),
              height: IN(h),
              fill: tone,
            }}
          >
            {g.d ? <path d={g.d} /> : null}
            {g.rects
              ? g.rects.map(([rx, ry, rw, rh], ri) => (
                  <rect key={ri} x={rx} y={ry} width={rw} height={rh} rx={0.47} ry={0.47} />
                ))
              : null}
          </svg>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Security layers                                                   */
/* ------------------------------------------------------------------ */

function PadlockIcon({ size = 0.11, tone = "#111" }: { size?: number; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: IN(size), height: IN(size), display: "inline-block", verticalAlign: "bottom" }}
      fill="none"
      stroke={tone}
      strokeWidth={2.2}
    >
      <rect x="4" y="10.5" width="16" height="11" rx="1.6" fill={tone} stroke="none" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <circle cx="12" cy="16" r="1.5" fill="#fff" stroke="none" />
    </svg>
  );
}

function ThermochromicBadge() {
  return (
    <div
      style={{
        border: "1px solid #64748b",
        borderRadius: IN(0.055),
        padding: "1px 3px",
        fontSize: "5pt",
        letterSpacing: "0.02em",
        color: "#334155",
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "#8a2529", fontWeight: 700 }}>●</span> HEAT SENSITIVE
    </div>
  );
}

/**
 * Fine-line guilloche lattice. Genuine security engraving effect: hairline
 * crossing curves that a copier resolves into a muddy band and a scanner moirés.
 * `height` is the exact area to fill (the caller handles clear-band clipping).
 */
function Guilloche({ width, height, stroke }: { width: number; height: number; stroke: string }) {
  const rows = 9;
  const w = width * 96;
  const h = height * 96;
  const paths: ReactNode[] = [];
  for (let i = 0; i < rows; i += 1) {
    const y = (h / rows) * i + h / (rows * 2);
    const amp = h / (rows * 2.6);
    paths.push(
      <path
        key={`w${i}`}
        d={`M0 ${y} C ${w * 0.18} ${y - amp}, ${w * 0.32} ${y + amp}, ${w * 0.5} ${y} S ${w * 0.82} ${y - amp}, ${w} ${y}`}
        fill="none"
        stroke={stroke}
        strokeWidth={0.45}
      />,
    );
    paths.push(
      <path
        key={`d${i}`}
        d={`M0 ${y + amp * 0.5} C ${w * 0.25} ${y + amp * 1.6}, ${w * 0.75} ${y - amp * 1.6}, ${w} ${y + amp * 0.5}`}
        fill="none"
        stroke={stroke}
        strokeWidth={0.3}
      />,
    );
    paths.push(
      <path
        key={`s${i}`}
        d={`M0 ${y - amp} S ${w * 0.4} ${y + amp * 1.2}, ${w * 0.6} ${y - amp * 0.4} S ${w * 0.9} ${y + amp}, ${w} ${y - amp * 0.2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={0.25}
      />,
    );
  }
  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: IN(width),
        height: IN(height),
        opacity: 0.5,
      }}
      viewBox={`0 0 ${w} ${h}`}
    >
      {paths}
    </svg>
  );
}

function MicroprintBorder({
  width,
  height,
  text,
  tone = "#8d949d",
  full = false,
}: {
  width: number;
  height: number;
  text: string;
  tone?: string;
  /** frame all 4 edges at full height (rear side has no clear-band limit) */
  full?: boolean;
}) {
  const band = 0.055;
  // contiguous microtext (no wide separators) so the band reads as a
  // security line rather than a sparse dotted border
  const repeat = (n: number) => Array.from({ length: Math.max(1, n) }, () => text).join("");
  const topLen = Math.ceil((width / 0.035) * 1.05);
  const sideLen = Math.ceil(((full ? height : height - 0.625) / 0.035) * 1.05);
  const bandStyle: CSSProperties = {
    fontSize: "1.6pt",
    letterSpacing: "0.01em",
    color: tone,
    whiteSpace: "nowrap",
    overflow: "hidden",
    lineHeight: IN(band),
  };
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: IN(band),
          ...bandStyle,
        }}
      >
        {repeat(topLen)}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: IN(band),
          height: full ? "100%" : undefined,
          ...(!full ? aboveClearBand : {}),
          fontSize: "1.6pt",
          color: tone,
          writingMode: "vertical-rl",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {repeat(sideLen)}
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: IN(band),
          height: full ? "100%" : undefined,
          ...(!full ? aboveClearBand : {}),
          fontSize: "1.6pt",
          color: tone,
          writingMode: "vertical-rl",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {repeat(sideLen)}
      </div>
      {full ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: IN(band),
            ...bandStyle,
          }}
        >
          {repeat(topLen)}
        </div>
      ) : null}
    </div>
  );
}

function UvFibers({ width, height, seed = 7 }: { width: number; height: number; seed?: number }) {
  const rand = (n: number) => {
    const v = Math.sin((seed + n) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  const dots = Array.from({ length: 46 }, (_, i) => {
    const hues = ["#b9d3ff", "#ffd9c9", "#d6c9ff"];
    return (
      <span
        key={i}
        style={{
          position: "absolute",
          left: IN(rand(i) * width),
          top: IN(rand(i + 100) * (height - 0.7)),
          width: IN(0.035),
          height: IN(0.012),
          background: hues[i % hues.length],
          opacity: 0.8,
          transform: `rotate(${Math.round(rand(i + 200) * 180)}deg)`,
        }}
      />
    );
  });
  return <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{dots}</div>;
}

/* ------------------------------------------------------------------ */
/* Check face                                                        */
/* ------------------------------------------------------------------ */

export function CheckFace({
  account,
  check,
  layoutId,
  watermark = "none",
}: {
  account: CheckAccountView;
  check: CheckView;
  layoutId: LayoutId;
  /** void / spec / record watermarks for non-negotiable output */
  watermark?: "none" | "void" | "specimen" | "record";
}) {
  const layout: LayoutSpec = LAYOUTS[layoutId] ?? getLayout(layoutId);
  const e = layout.elements;
  const f = check.features ?? [];
  const has = (id: string) => f.includes(id);
  const bg = getBackground(check.background || account.background);
  const legal = legalAmount(check.amountCents);
  const serial = String(check.checkNumber);
  // company logo to the LEFT of the drawer block (standard check placement).
  // Drawer name, address and phone all share one font size so a phone-camera
  // deposit capture reads every line equally.
  const compactFace = layout.height < 3.2;
  const companyW = account.companyLogoDataUrl
    ? Math.min(account.companyLogoWidthIn || 1.2, compactFace ? 0.6 : 1.4, e.holder.w * 0.45)
    : 0;
  const holderTextW = e.holder.w - (companyW ? companyW + 0.08 : 0);

  return (
    <div
      className="check-face"
      style={{
        position: "relative",
        width: IN(layout.width),
        height: IN(layout.height),
        background: "#fff",
        overflow: "hidden",
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        color: "#0b1220",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {watermark !== "none" ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              transform: "rotate(-24deg)",
              fontSize: "34pt",
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "rgba(190, 42, 45, 0.25)",
              border: "3px solid rgba(190, 42, 45, 0.25)",
              borderRadius: IN(0.08),
              padding: `2px ${IN(0.18)}`,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}
          >
            {watermark === "void"
              ? "VOID — DO NOT PRESENT"
              : watermark === "specimen"
                ? "SPECIMEN — ALREADY CLEARED"
                : "RECORD COPY — NOT NEGOTIABLE"}
          </span>
        </div>
      ) : null}
      {/* security background stock — always clipped above the clear band */}
      <BackgroundStock bg={bg} width={layout.width} height={layout.height} />
      {has("uv_fibers") ? <UvFibers width={layout.width} height={layout.height} /> : null}
      {has("microprint") ? (
        <MicroprintBorder
          width={layout.width}
          height={layout.height}
          text="SECUREDOCUMENTMICROPRINTSECURITYFEATUREVERIFICATION"
        />
      ) : null}

      {/* drawer (account holder) — LEFT, company logo beside it. Every line at
          the same 7.5pt so captures stay legible. */}
      {account.companyLogoDataUrl ? (
        <At x={e.holder.x} y={e.holder.y} w={companyW}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={account.companyLogoDataUrl}
            alt=""
            style={{
              width: IN(companyW),
              height: IN(Math.min(companyW * 0.5, 0.42)),
              objectFit: "contain",
              objectPosition: "left top",
              display: "block",
            }}
          />
        </At>
      ) : null}
      <At
        x={e.holder.x + (companyW ? companyW + 0.08 : 0)}
        y={e.holder.y}
        w={holderTextW}
        align={e.holder.align === "right" ? "right" : "left"}
      >
        <div style={{ fontSize: "7.5pt", fontWeight: 700, letterSpacing: "0.01em", color: "#0b1220" }}>
          {account.holderName}
        </div>
        <div style={{ fontSize: "7.5pt", fontWeight: 400, lineHeight: 1.22, color: "#0b1220", whiteSpace: "pre-line" }}>
          {account.holderAddress}
        </div>
        {account.holderPhone ? (
          <div style={{ fontSize: "7.5pt", fontWeight: 400, color: "#0b1220" }}>{account.holderPhone}</div>
        ) : null}
      </At>

      {/* drawee bank — MIDDLE, logo sized by the operator */}
      <At x={e.bank.x} y={e.bank.y} w={e.bank.w} align={e.bank.align ?? "center"}>
        {account.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.logoDataUrl}
            alt=""
            style={{
              width: IN(account.bankLogoWidthIn || 1.5),
              height: IN((account.bankLogoWidthIn || 1.5) * 0.4),
              objectFit: "contain",
              marginBottom: 2,
              marginLeft: "auto",
              marginRight: "auto",
              display: "block",
            }}
          />
        ) : null}
        <div style={{ fontSize: "8pt", fontWeight: 700, letterSpacing: "0.01em" }}>
          {account.bankName}
        </div>
        {account.bankAddress ? (
          <div style={{ fontSize: "6.5pt", lineHeight: 1.25, color: "#1f2937", whiteSpace: "pre-line" }}>
            {account.bankAddress}
          </div>
        ) : null}
      </At>

      {/* corner serial */}
      <At x={e.checkNumber.x} y={e.checkNumber.y} w={e.checkNumber.w} align="right">
        <div style={{ fontSize: "10pt", fontWeight: 700, letterSpacing: "0.04em" }}>{serial}</div>
      </At>

      {/* fractional transit number — strictly operator-entered on the account;
          prints only when the feature is enabled AND a fraction exists */}
      {has("fraction") && account.fraction ? (
        <At x={e.fraction.x} y={e.fraction.y} w={e.fraction.w} align="right">
          <div style={{ fontSize: "7pt", color: "#111827", letterSpacing: "0.02em" }}>
            {account.fraction}
          </div>
        </At>
      ) : null}

      {/* date */}
      <At x={e.date.labelX} y={e.date.y} style={{ fontSize: "6pt", color: "#334155" }}>
        DATE
      </At>
      <div
        style={{
          position: "absolute",
          left: IN(e.date.lineX),
          top: IN(e.date.y - 0.03),
          width: IN(e.date.w),
          borderBottom: "0.75px solid #6b7480",
          fontSize: "8.5pt",
          textAlign: "center",
          paddingBottom: 1,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {formatDate(check.dateIssued)}
      </div>

      {/* legal amount — WORDS COME FIRST on the instrument (UCC 3-114).
          No white patch: the asterisk guard runs as leading/trailing fills on
          the same tinted stock so the line blends with the background. */}
      <At x={e.legalAmount.labelX} y={e.legalAmount.labelY} style={{ fontSize: "6pt", color: "#334155", letterSpacing: "0.02em" }}>
        AMOUNT IN WORDS
      </At>
      <div
        style={{
          position: "absolute",
          left: IN(e.legalAmount.x),
          top: IN(e.legalAmount.y),
          width: IN(e.legalAmount.w),
          height: IN(0.19),
          borderBottom: "0.75px solid #6b7480",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        {has("legal_amount_guard") ? (
          <span
            aria-hidden
            style={{
              flex: "1 1 0",
              minWidth: 0,
              fontSize: "8pt",
              fontWeight: 600,
              color: "#52606d",
              letterSpacing: "-0.02em",
              overflow: "hidden",
              whiteSpace: "nowrap",
              lineHeight: 1,
              paddingBottom: 1,
            }}
          >
            {"********".repeat(30)}
          </span>
        ) : null}
        <div
          style={{
            fontSize: "8pt",
            fontWeight: 600,
            color: "#0b1220",
            width: "fit-content",
            overflow: "hidden",
            whiteSpace: "nowrap",
            lineHeight: 1,
            paddingBottom: 1,
            paddingRight: 3,
            paddingLeft: 3,
          }}
        >
          {legal}
        </div>
        {has("legal_amount_guard") ? (
          <span
            aria-hidden
            style={{
              flex: "1 1 0",
              minWidth: 0,
              fontSize: "8pt",
              fontWeight: 600,
              color: "#52606d",
              letterSpacing: "-0.02em",
              overflow: "hidden",
              whiteSpace: "nowrap",
              lineHeight: 1,
              paddingBottom: 1,
            }}
          >
            {"********".repeat(30)}
          </span>
        ) : null}
      </div>

      {/* payee — name on the rule, address in standard form under it at the
          same size as the payee line so it stays fully legible */}
      <At x={e.payee.labelX} y={e.payee.labelY} style={{ fontSize: "6pt", color: "#334155" }}>
        PAY TO THE
        <br /> ORDER OF
      </At>
      <div
        style={{
          position: "absolute",
          left: IN(e.payee.x),
          top: IN(e.payee.y),
          width: IN(e.payee.w),
        }}
      >
        <div
          style={{
            borderBottom: "0.75px solid #6b7480",
            fontSize: "9pt",
            fontWeight: 500,
            paddingBottom: 1,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {check.payeeName}
        </div>
        {(() => {
          const addr = formatAddressBlock(check.payeeAddress ?? "");
          const lineStyle: CSSProperties = {
            fontSize: "9pt",
            fontWeight: 400,
            color: "#0b1220",
            lineHeight: 1.12,
            letterSpacing: "0.01em",
            overflow: "hidden",
            whiteSpace: "nowrap",
          };
          if (!addr.line1 && !addr.line2) return null;
          return (
            <div style={{ marginTop: 1 }}>
              {addr.line1 ? <div style={lineStyle}>{addr.line1}</div> : null}
              {addr.line2 ? <div style={lineStyle}>{addr.line2}</div> : null}
            </div>
          );
        })()}
      </div>

      {/* courtesy amount box — lower third of the right column, per standard */}
      <div
        style={{
          position: "absolute",
          left: IN(e.amountBox.x),
          top: IN(e.amountBox.y),
          width: IN(e.amountBox.w),
          height: IN(e.amountBox.h),
          border: "1px solid #1f2937",
          background: "#fff",
          fontSize: "10pt",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 4,
          letterSpacing: "0.01em",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ marginRight: 2, fontSize: "8pt", color: "#1f2937" }}>$</span>
        {formatCents(check.amountCents).replace("$", "")}
      </div>

      {/* optional stale-date notice — only printed when selected (UCC 3-108(b)) */}
      {(() => {
        const voidAfter = f.includes("void_90_days") ? 90 : f.includes("void_180_days") ? 180 : null;
        if (!voidAfter) return null;
        return (
          <At
            x={e.amountBox.x + e.amountBox.w - 1.55}
            y={e.amountBox.y + e.amountBox.h + 0.015}
            w={1.55}
            align="right"
            style={{
              fontSize: "5.5pt",
              fontWeight: 800,
              letterSpacing: "0.05em",
              color: "#8a2529",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {`VOID AFTER ${voidAfter} DAYS`}
          </At>
        );
      })()}

      {/* memo */}
      <At x={e.memo.labelX} y={e.memo.labelY} style={{ fontSize: "6pt", color: "#334155" }}>
        MEMO
      </At>
      <div
        style={{
          position: "absolute",
          left: IN(e.memo.x),
          top: IN(e.memo.y),
          width: IN(e.memo.w),
          borderBottom: "0.75px solid #6b7480",
          fontSize: "8pt",
          paddingBottom: 1,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {check.memo}
      </div>

      {/* signature block — flush to the right edge; padlock/MP and the
          heat-sensitive badge share ONE right-aligned row directly above the
          signature rule (standard check placement, single baseline) */}
      <div
        style={{
          position: "absolute",
          left: IN(e.signature.x),
          top: IN(e.signature.y),
          width: IN(e.signature.w),
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: IN(0.045),
            height: IN(0.14),
            marginBottom: IN(0.015),
          }}
        >
          {has("thermochromic") ? <ThermochromicBadge /> : null}
          {has("padlock") ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <span
                style={{
                  fontSize: "5pt",
                  color: "#0b1220",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                MP
              </span>
              <PadlockIcon size={0.1} />
            </span>
          ) : null}
        </div>
        <div style={{ position: "relative", height: IN(0.18) }}>
          {/* SIGNATURE RULE — with the microprint feature on, the line itself is
              a dense row of sub-3pt security type (ABA/CPA microprint
              definition): reads as a solid ruled line to the eye and the
              teller, collapses into fine speckle when copied, and stays in the
              same spot a standard signature rule occupies. */}
          {has("microprint") ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: IN(0.042),
                overflow: "hidden",
                whiteSpace: "nowrap",
                fontSize: "1.7pt",
                fontWeight: 600,
                lineHeight: IN(0.042),
                letterSpacing: 0,
                color: "#334155",
              }}
            >
              {"SIGNATURELINEMICROPRINTSECURITYVERIFYAUTHENTICITEM".repeat(10)}
            </div>
          ) : (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                borderBottom: "1px solid #334155",
              }}
            />
          )}
          {check.signatureMode === "image" && account.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.signatureDataUrl}
              alt=""
              style={{
                position: "absolute",
                left: "50%",
                bottom: 0,
                height: "96%",
                objectFit: "contain",
                transform: "translateX(-50%)",
              }}
            />
          ) : null}
          {check.signatureMode === "facsimile" && account.signatureText ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: "-1.5pt",
                transform: "translateX(-50%)",
                fontFamily: '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive',
                fontSize: "11.5pt",
                color: "#101828",
                whiteSpace: "nowrap",
              }}
            >
              {account.signatureText}
            </div>
          ) : null}
        </div>
        <div
          style={{
            fontSize: "6pt",
            color: "#334155",
            letterSpacing: "0.02em",
            textAlign: "right",
            marginTop: 1,
          }}
        >
          {account.signatureTitle.toUpperCase()}
        </div>
      </div>

      {/* MICR line */}
      <MicrLine
        checkWidthIn={layout.width}
        routingNumber={account.routingNumber}
        accountNumber={account.accountNumber}
        checkNumber={serial}
        onUsFormat={(account.onUsFormat as OnUsFormat) ?? "account-symbol-serial"}
        auxOnUs={layout.supportsAuxOnUs}
        includeAmount={check.includeAmountField}
        amountCents={check.amountCents}
        renderer={account.micrRenderer}
        fontDataUrl={account.micrFontDataUrl}
        fontSizePt={account.micrFontSizePt}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Position gauge overlay                                            */
/* ------------------------------------------------------------------ */

/** ANSI X9.13 / E-13B position gauge overlay for pre-run verification. */
export function MicrGauge({ layoutId }: { layoutId: LayoutId }) {
  const layout = LAYOUTS[layoutId] ?? getLayout(layoutId);
  const micr = layoutMicr({
    checkWidthIn: layout.width,
    routingNumber: "000000000",
    accountNumber: "000000000",
    checkNumber: "0000",
    auxOnUs: layout.supportsAuxOnUs,
  });
  const cells: ReactNode[] = [];
  for (let i = 0; i < 65; i += 1) {
    const x = layout.width - 0.3125 - (i + 1) * MICR_PITCH;
    if (x < 0.2) break;
    cells.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: IN(x),
          bottom: IN(0.125),
          width: IN(MICR_PITCH),
          height: IN(0.29),
          borderLeft: "0.5px solid rgba(13,148,136,0.55)",
          borderTop: "0.5px solid rgba(13,148,136,0.35)",
          borderBottom: "0.5px solid rgba(13,148,136,0.35)",
        }}
      />,
    );
  }
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 30,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: IN(layout.height - 0.625),
          borderTop: "1px dashed rgba(217,70,239,0.85)",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: IN(0.06),
            top: 1,
            fontSize: "5pt",
            color: "#a21caf",
            background: "rgba(255,255,255,0.85)",
            padding: "0 2px",
          }}
        >
          5/8&quot; MICR CLEAR BAND
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: IN(0.4375),
          borderBottom: "0.5px dashed rgba(13,148,136,0.7)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: IN(MICR_BASELINE),
          borderBottom: "1px solid rgba(13,148,136,0.9)",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: IN(0.06),
            bottom: 1,
            fontSize: "5pt",
            color: "#0f766e",
            background: "rgba(255,255,255,0.88)",
            padding: "0 2px",
          }}
        >
          BASELINE 3/16&quot; · PITCH 1/8&quot;
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          right: IN(0.3125),
          bottom: IN(0.125),
          width: 0,
          height: IN(0.3),
          borderRight: "1px solid rgba(217,70,239,0.9)",
        }}
      />
      {cells}
      {(["transit", "onUs", "auxOnUs", "amount"] as const).map((key) => {
        const range = micr.fieldPositions[key];
        if (!range) return null;
        // derive the ANSI position numbers from the measured inches
        const posRight = Math.round((layout.width - MICR_LEADING_EDGE - range[1]) / MICR_PITCH) + 1;
        const posLeft = Math.round((layout.width - MICR_LEADING_EDGE - (range[0] + MICR_PITCH)) / MICR_PITCH) + 1;
        const names: Record<string, string> = {
          transit: "TRANSIT",
          onUs: "ON-US",
          auxOnUs: "AUX ON-US",
          amount: "AMOUNT",
        };
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              left: IN(range[0]),
              top: IN(layout.height - 0.625),
              width: IN(range[1] - range[0]),
              height: IN(0.14),
              background: "rgba(13,148,136,0.18)",
              border: "0.5px solid rgba(13,148,136,0.6)",
              fontSize: "4.2pt",
              color: "#0f766e",
              textAlign: "center",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {`${names[key]} ${posRight}-${posLeft}`}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Check back                                                        */
/* ------------------------------------------------------------------ */

export function CheckBack({
  account,
  check,
  layoutId,
}: {
  account: CheckAccountView;
  check: CheckView;
  layoutId: LayoutId;
}) {
  const layout = LAYOUTS[layoutId] ?? getLayout(layoutId);
  const f = check.features ?? [];
  const has = (id: string) => f.includes(id);
  const bg = getBackground(check.background || account.background);

  /*
   * REVERSE SIDE — laid out RIGHT TO LEFT in vertical columns, the way a real
   * bank check back is printed. All text runs rotated (top→bottom, lines
   * stacking right→left), so turning the sheet 90° counter-clockwise reads it
   * in the classic order: endorsement + signing rails first, then the "do not
   * write below" rule, the disclosure boxes, the warning clause and the
   * reference.
   *
   *   document space, right → left:
   *   [❶ ENDORSE HERE + rails] [divider caption + rule] [security box]
   *   [restriction box] [warning clause]
   */
  const h = layout.height;
  const compact = h < 3.2; // wallet-class documents
  const m = compact ? 0.18 : 0.26; // outer side margin
  const mv = compact ? 0.13 : 0.16; // column top/bottom margin
  const colH = h - mv * 2;
  const gap = compact ? 0.07 : 0.09;

  const wEndorse = compact ? 0.95 : 1.25;
  const wDivText = compact ? 0.3 : 0.38;
  const wSecurity = compact ? 1.7 : 2.35;
  const wRestrict = compact ? 1.15 : 1.6;

  // measured from the RIGHT edge so the endorsement column always leads
  const xEndorse = layout.width - m - wEndorse;
  const xDivText = xEndorse - gap - wDivText;
  const xRule = xDivText - 0.02;
  const xSecurity = xRule - gap - wSecurity;
  const xRestrict = xSecurity - gap - wRestrict;
  const xWarnRight = xRestrict - gap;
  // warning clause reaches across to the left margin (no reference strip)
  const wWarn = xWarnRight - (m + 0.03);
  const xWarn = xWarnRight - wWarn;

  /** rotated text: reads top→bottom; stack right→left */
  const vertical = {
    writingMode: "vertical-rl",
    textOrientation: "mixed",
  } as const;

  const features = [
    has("microprint") && "Microprinted border and signature rule",
    has("watermark") &&
      (bg.pattern === "guilloche" || bg.pattern === "rosettes" || bg.pattern === "rings" || bg.pattern === "waves"
        ? "Engraved guilloche background"
        : "Two-tone security screen"),
    has("prismatic") && "Prismatic security screen",
    has("chem_reactive") && "Chemical-reactive stain paper",
    has("thermochromic") && "Thermochromic (heat-sensitive) ink icon",
    has("uv_fibers") && "UV fluorescent fibres",
    has("erasure_guard") && "Erasure-resistant toner fusion",
    has("ird_compatible") && "Image-exchange contrast compliance",
    (has("void_90_days") || has("void_180_days")) &&
      `Void after ${has("void_180_days") && !has("void_90_days") ? 180 : 90} days notice`,
  ].filter(Boolean) as string[];

  const border = "1px solid #59636f";

  return (
    <div
      className="check-back"
      style={{
        position: "relative",
        width: IN(layout.width),
        height: IN(layout.height),
        background: "#fff",
        overflow: "hidden",
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        color: "#0b1220",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* the reverse carries no MICR line: the stock covers the full sheet and
          the microprint border frames all four corners. Column geometry is
          measured from the same trim edges as the face, so a duplexed sheet
          cuts out in exact register with the front. */}
      <BackgroundStock bg={bg} width={layout.width} height={layout.height} full />
      {has("microprint") ? (
        <MicroprintBorder
          width={layout.width}
          height={layout.height}
          text="ENDORESEMENTLIMITEDMICROPRINTSECURITYLINEVERIFICATION"
          full
        />
      ) : null}

      {/* ❶ ENDORSE HERE — leading column at the far right: header, caption,
          then three vertical signing rails (horizontal lines once turned) */}
      <div
        style={{
          position: "absolute",
          left: IN(xEndorse),
          top: IN(mv),
          width: IN(wEndorse),
          height: IN(colH),
        }}
      >
        <div
          style={{
            ...vertical,
            position: "absolute",
            right: 0,
            top: 0,
            height: "100%",
            fontSize: compact ? "6.8pt" : "7.4pt",
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: "#0b1220",
          }}
        >
          ENDORSE HERE
        </div>
        <div
          style={{
            ...vertical,
            position: "absolute",
            right: IN(0.2),
            top: 0,
            height: "100%",
            fontSize: "5pt",
            letterSpacing: "0.04em",
            color: "#334155",
          }}
        >
          SIGN ON THE LINES — DO NOT WRITE BELOW THE RULE
        </div>
        {[0.12, 0.5, 0.88].map((fx) => (
          <div
            key={fx}
            style={{
              position: "absolute",
              left: IN(0.02 + (wEndorse - 0.42) * fx),
              top: IN(0.02),
              height: IN(colH - 0.04),
              borderLeft: "1px solid #8d99a6",
            }}
          />
        ))}
      </div>

      {/* ❷ divider caption + full-height rule (below the rails once turned) */}
      <div
        style={{
          ...vertical,
          position: "absolute",
          left: IN(xDivText),
          top: IN(mv),
          width: IN(wDivText),
          height: IN(colH),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: compact ? "5.6pt" : "6pt",
          fontWeight: 700,
          letterSpacing: "0.09em",
          color: "#0b1220",
        }}
      >
        DO NOT WRITE, STAMP OR SIGN BELOW THIS LINE
      </div>
      <div
        style={{
          position: "absolute",
          left: IN(xRule),
          top: IN(mv),
          width: 0,
          height: IN(colH),
          borderLeft: "1.4px solid #0b1220",
        }}
      />

      {/* ❸ security feature disclosure — vertical box */}
      {has("padlock") ? (
        <div
          style={{
            ...vertical,
            position: "absolute",
            left: IN(xSecurity),
            top: IN(mv),
            width: IN(wSecurity),
            height: IN(colH),
            border,
            padding: IN(0.05),
            boxSizing: "border-box",
            overflow: "hidden",
            background: "rgba(255,255,255,0.75)",
            display: "flex",
            flexDirection: "column",
            gap: IN(0.04),
          }}
        >
          <div
            style={{
              fontSize: compact ? "6.2pt" : "6.6pt",
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "#0b1220",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {/* pre-rotated so the padlock stands upright once the sheet is
                turned 90° to read the reverse */}
            <span style={{ display: "inline-flex", transform: "rotate(90deg)", transformOrigin: "center" }}>
              <PadlockIcon size={compact ? 0.11 : 0.125} />
            </span>{" "}
            SECURITY FEATURES OF THIS DOCUMENT
          </div>
          {features.length ? (
            features.map((feat) => (
              <div
                key={feat}
                style={{ fontSize: compact ? "5.2pt" : "5.6pt", lineHeight: 1.4, color: "#1f2937" }}
              >
                · {feat}
              </div>
            ))
          ) : (
            <div style={{ fontSize: compact ? "5.2pt" : "5.6pt", color: "#1f2937" }}>
              · No security features disclosed.
            </div>
          )}
        </div>
      ) : null}

      {/* ❹ endorsement restriction — vertical box */}
      <div
        style={{
          ...vertical,
          position: "absolute",
          left: IN(xRestrict),
          top: IN(mv),
          width: IN(wRestrict),
          height: IN(colH),
          border,
          padding: IN(0.05),
          boxSizing: "border-box",
          overflow: "hidden",
          background: "rgba(255,255,255,0.75)",
          display: "flex",
          flexDirection: "column",
          gap: IN(0.04),
        }}
      >
        <div
          style={{
            fontSize: compact ? "5.8pt" : "6.2pt",
            fontWeight: 800,
            letterSpacing: "0.05em",
            color: "#0b1220",
            whiteSpace: "nowrap",
          }}
        >
          ENDORSEMENT RESTRICTION
        </div>
        <div
          style={{ fontSize: compact ? "5pt" : "5.4pt", lineHeight: 1.45, color: "#1f2937" }}
        >
          FOR DEPOSIT ONLY TO THE ACCOUNT OF THE PAYEE NAMED ON THE FACE. THIS ENDORSEMENT IS PART
          OF A RESTRICTIVE ENDORSEMENT PROGRAM AND IS NOT TRANSFERABLE BY DELIVERY.
        </div>
      </div>

      {/* ❺ warning clause — free vertical paragraph, reaches the left margin */}
      {has("warning_band") ? (
        <div
          style={{
            ...vertical,
            position: "absolute",
            left: IN(xWarn),
            top: IN(mv),
            width: IN(wWarn),
            height: IN(colH),
            overflow: "hidden",
            fontSize: compact ? "4.9pt" : "5.3pt",
            lineHeight: 1.55,
            color: "#1f2937",
          }}
        >
          <span style={{ fontWeight: 800, letterSpacing: "0.05em" }}>
            WARNING: THIS DOCUMENT CONTAINS THE SECURITY FEATURES LISTED ABOVE.
          </span>{" "}
          IF YOU HAVE ANY QUESTION CONCERNING THIS DOCUMENT, OR IF YOU SUSPECT IT HAS BEEN ALTERED,
          DO NOT CASH OR DEPOSIT IT — CALL THE DRAWEE BANK USING THE ROUTING NUMBER SHOWN ON THE
          FACE. THIS DOCUMENT IS GOVERNED BY UNIFORM COMMERCIAL CODE ARTICLE 3 AND REGULATION CC.
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet imposition + stubs                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Perforation cut guides + detach wording                            */
/* ------------------------------------------------------------------ */

const DETACH_COLOR = "#9aa4b2";

/**
 * Perforation-style cut guides ("broken hyphen" lines) that demarcate the
 * check from the rest of the printed sheet, with the standard detach wording.
 * Rendered with identical geometry on the face sheet and on the reverse page
 * so both cut out in register. Lines never enter a face's clear band.
 */
export function SheetDetachGuides({ layout }: { layout: LayoutSpec }) {
  const { page, offsets, stubs } = layout;
  const elements: ReactNode[] = [];
  const hYs: { y: number; label: boolean }[] = [];
  const checkBottoms = offsets.map(([, y]) => y + layout.height);
  const lastBottom = checkBottoms[checkBottoms.length - 1];

  if (stubs[0]?.side === "right") {
    // wallet-3 rows: full-width separators between rows and sheet margins
    hYs.push({ y: offsets[0][1] / 2, label: true });
    for (let i = 0; i < offsets.length - 1; i += 1) {
      hYs.push({ y: (checkBottoms[i] + offsets[i + 1][1]) / 2, label: true });
    }
    hYs.push({ y: (lastBottom + page.height) / 2, label: true });
    // vertical tear line between each check and its stub + rotated wording
    stubs.forEach((s, i) => {
      const xLine = s.x - 0.1;
      elements.push(
        <div
          key={`v${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: IN(xLine),
            top: IN(offsets[i][1]),
            width: 0,
            height: IN(layout.height),
            borderLeft: `1.2px dashed ${DETACH_COLOR}`,
          }}
        />,
      );
      elements.push(
        <div
          key={`vl${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: IN(xLine + 0.01),
            top: IN(offsets[i][1] + 0.08),
            width: IN(0.085),
            height: IN(layout.height - 0.16),
            writingMode: "vertical-rl",
            fontSize: "4.2pt",
            letterSpacing: "0.06em",
            color: "#59636f",
            whiteSpace: "nowrap",
            overflow: "hidden",
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          ✂ DETACH HERE
        </div>,
      );
    });
  } else if (stubs[0]?.side === "bottom") {
    // full-width voucher sheet: the tear line sits just inside each stub,
    // clear of the face's MICR band
    stubs.forEach((s, i) => {
      hYs.push({ y: s.y + 0.015, label: false });
      elements.push(
        <div
          key={`bl${i}`}
          aria-hidden
          style={{
            position: "absolute",
            right: IN(0.25),
            top: IN(s.y + 0.045),
            fontSize: "4.4pt",
            letterSpacing: "0.08em",
            color: DETACH_COLOR,
            whiteSpace: "nowrap",
          }}
        >
          ✂ DETACH HERE
        </div>,
      );
    });
    hYs.push({ y: (lastBottom + page.height) / 2, label: false });
  } else {
    // single-check sheet: one cut line below the check
    hYs.push({ y: (lastBottom + page.height) / 2, label: true });
  }

  for (const { y, label } of hYs) {
    if (y < 0.05 || y > page.height - 0.05) continue;
    elements.push(
      <div
        key={`h${y}`}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: IN(y),
          width: "100%",
          borderTop: `1.2px dashed ${DETACH_COLOR}`,
        }}
      />,
    );
    if (label) {
      elements.push(
        <div
          key={`hl${y}`}
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: IN(y + 0.015),
            width: "100%",
            textAlign: "center",
            fontSize: "4.6pt",
            letterSpacing: "0.08em",
            color: DETACH_COLOR,
            whiteSpace: "nowrap",
          }}
        >
          ✂ DETACH HERE
        </div>,
      );
    }
  }

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {elements}
    </div>
  );
}

export function CheckStub({
  account,
  check,
  index,
}: {
  account: CheckAccountView;
  check: CheckView;
  index: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "1px dashed #9aa4b2",
        padding: IN(0.1),
        fontSize: "6.5pt",
        color: "#243044",
        background: "#fff",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
        <span>{index === 0 ? "PAYOR RECORD" : index === 1 ? "PAYEE RECORD" : "FILE RECORD"}</span>
        <span>
          No. {check.checkNumber} · {formatCents(check.amountCents)}
        </span>
      </div>
      <div>{check.payeeName}</div>
      <div style={{ color: "#1f2937" }}>{formatDate(check.dateIssued)}</div>
      <div style={{ color: "#1f2937" }}>Memo: {check.memo || "—"}</div>
      <div style={{ marginTop: "auto", color: "#1f2937", fontSize: "5.5pt" }}>
        {account.holderName} ····{account.accountNumber.slice(-4)} · Routing {account.routingNumber}
      </div>
    </div>
  );
}

export function CheckSheet({
  account,
  check,
  layoutId,
  copies = 1,
  watermark = "none",
}: {
  account: CheckAccountView;
  check: CheckView;
  layoutId: LayoutId;
  /** number of instruments to place on the sheet */
  copies?: number;
  /** watermark for every instrument (void / specimen reprints) */
  watermark?: "none" | "void" | "specimen" | "record";
}) {
  const layout = LAYOUTS[layoutId] ?? getLayout(layoutId);
  const items = Array.from({ length: Math.max(1, copies) }, (_, i) => i);
  return (
    <div
      className="check-sheet"
      style={{ position: "relative", width: IN(layout.page.width), height: IN(layout.page.height), background: "#fff" }}
    >
      <SheetDetachGuides layout={layout} />
      {items.map((i) => {
        const off = layout.offsets[Math.min(i, layout.offsets.length - 1)];
        // only the FIRST instrument is the negotiable original; any duplicated
        // position on the sheet is a record copy (duplicate serials would be
        // a double-payment risk, so they are clearly marked)
        const mark: "none" | "void" | "specimen" | "record" =
          watermark !== "none" ? watermark : i === 0 ? "none" : "record";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: IN(off[0]),
              top: IN(off[1]),
              width: IN(layout.width),
              height: IN(layout.height),
            }}
          >
            <CheckFace account={account} check={check} layoutId={layoutId} watermark={mark} />
          </div>
        );
      })}
      {layout.stubs.map((s, i) => (
        <div
          key={`stub-${i}`}
          style={{
            position: "absolute",
            left: IN(s.x),
            top: IN(s.y),
            width: IN(s.width),
            height: IN(s.height),
          }}
        >
          <CheckStub account={account} check={check} index={i} />
        </div>
      ))}
      <div
        className="no-print"
        style={{
          position: "absolute",
          left: 0,
          bottom: IN(0.2),
          width: "100%",
          textAlign: "center",
          fontSize: "5pt",
          color: "#c3c9d2",
        }}
      >
        Print at 100% / Actual Size on 24 lb+ bond or blank security check stock · Verify the MICR
        baseline at 3/16&quot; from the trim edge with an E-13B position gauge
      </div>
    </div>
  );
}
