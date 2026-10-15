/**
 * Check stock layouts. Every coordinate is expressed in inches from the
 * top-left corner of the check so the printed output lands on ANSI/CPA
 * position tolerances when the browser prints at 100% scale.
 *
 * Face dimensions follow the standard US check sizes:
 *   - Personal / wallet:  6"      × 2¾"
 *   - Business laser:     8½"     × 3½"
 */

export type LayoutId = "wallet" | "wallet3" | "voucher" | "business";

export type LayoutSpec = {
  id: LayoutId;
  name: string;
  description: string;
  /** check face dimensions in inches */
  width: number;
  height: number;
  /** printable page the layout is imposed on */
  page: { width: number; height: number };
  /** number of checks per printed page */
  perPage: number;
  /** top-left offsets of each check on the page */
  offsets: [number, number][];
  /** stubs rendered beside/below each check */
  stubs: { x: number; y: number; width: number; height: number; side: "left" | "right" | "bottom" }[];
  /** 6" personal checks cannot carry an Auxiliary On-Us field */
  supportsAuxOnUs: boolean;
  elements: LayoutElements;
};

export type LayoutElements = {
  bank: { x: number; y: number; w: number; align?: "left" | "right" | "center" };
  holder: { x: number; y: number; w: number; align: "left" | "right" | "center" };
  checkNumber: { x: number; y: number; w: number; align: "left" | "right" };
  fraction: { x: number; y: number; w: number; align: "left" | "right" };
  date: { labelX: number; y: number; lineX: number; w: number };
  /** legal amount in words — printed FIRST, above the payee block */
  legalAmount: { x: number; y: number; w: number; labelX: number; labelY: number };
  payee: { labelX: number; labelY: number; x: number; y: number; w: number };
  amountBox: { x: number; y: number; w: number; h: number };
  memo: { labelX: number; labelY: number; x: number; y: number; w: number };
  signature: { x: number; y: number; w: number };
  endorsement: { x: number; y: number; w: number; h: number };
};

const walletElements: LayoutElements = {
  // Drawer (account holder) LEFT, drawee bank MIDDLE, serial RIGHT.
  holder: { x: 0.2, y: 0.1, w: 2.15, align: "left" },
  bank: { x: 2.45, y: 0.1, w: 2.05, align: "center" },
  checkNumber: { x: 5.2, y: 0.1, w: 0.6, align: "right" },
  fraction: { x: 4.55, y: 0.36, w: 1.25, align: "right" },
  date: { labelX: 4.02, y: 0.6, lineX: 4.48, w: 1.32 },
  amountBox: { x: 4.92, y: 1.0, w: 0.88, h: 0.28 },
  // amount in WORDS leads the instrument; payee name + address follow under it
  legalAmount: { x: 0.2, y: 0.9, w: 4.55, labelX: 0.2, labelY: 0.82 },
  payee: { labelX: 0.2, labelY: 1.22, x: 1.22, y: 1.16, w: 3.3 },
  memo: { labelX: 0.2, labelY: 1.96, x: 0.82, y: 1.9, w: 1.9 },
  signature: { x: 3.5, y: 1.52, w: 2.3 },
  endorsement: { x: 0.25, y: 0.35, w: 5.5, h: 1.1 },
};

const wideElements: LayoutElements = {
  // Drawer (account holder) LEFT, drawee bank MIDDLE, serial RIGHT.
  holder: { x: 0.28, y: 0.16, w: 2.75, align: "left" },
  bank: { x: 3.2, y: 0.16, w: 3.4, align: "center" },
  checkNumber: { x: 7.6, y: 0.16, w: 0.62, align: "right" },
  fraction: { x: 6.9, y: 0.44, w: 1.3, align: "right" },
  date: { labelX: 6.28, y: 0.72, lineX: 6.76, w: 1.45 },
  amountBox: { x: 7.3, y: 1.16, w: 1.0, h: 0.32 },
  // amount in WORDS leads the instrument; payee name + address follow under it
  legalAmount: { x: 0.28, y: 1.12, w: 6.9, labelX: 0.28, labelY: 1.04 },
  payee: { labelX: 0.28, labelY: 1.5, x: 1.5, y: 1.44, w: 5.6 },
  memo: { labelX: 0.28, labelY: 2.42, x: 0.95, y: 2.36, w: 2.4 },
  signature: { x: 5.75, y: 2.0, w: 2.5 },
  endorsement: { x: 0.35, y: 0.4, w: 7.8, h: 1.3 },
};

export const LAYOUTS: Record<LayoutId, LayoutSpec> = {
  wallet: {
    id: "wallet",
    name: "Personal / Wallet (6\" × 2¾\")",
    description:
      "Standard single-wallet check at the conventional personal size. 6-inch documents cannot carry an Auxiliary On-Us field, so the check serial rides in the On-Us field.",
    width: 6,
    height: 2.75,
    page: { width: 8.5, height: 11 },
    perPage: 1,
    offsets: [[0.5, 0.5]],
    stubs: [],
    supportsAuxOnUs: false,
    elements: walletElements,
  },
  wallet3: {
    id: "wallet3",
    name: "Wallet — 3 per page with stubs",
    description:
      "Three wallet checks (6\" × 2¾\" each) imposed on a letter sheet with detachable side stubs — the standard personal check stock.",
    width: 6,
    height: 2.75,
    page: { width: 8.5, height: 11 },
    perPage: 3,
    offsets: [
      [0.25, 0.4],
      [0.25, 3.45],
      [0.25, 6.5],
    ],
    stubs: [
      { x: 6.45, y: 0.4, width: 1.85, height: 2.75, side: "right" },
      { x: 6.45, y: 3.45, width: 1.85, height: 2.75, side: "right" },
      { x: 6.45, y: 6.5, width: 1.85, height: 2.75, side: "right" },
    ],
    supportsAuxOnUs: false,
    elements: walletElements,
  },
  voucher: {
    id: "voucher",
    name: "Business Voucher (8½\" × 3½\")",
    description:
      "Full-width business check at the standard laser size, with two voucher stubs. Longer than 6½\" so the check serial is carried in the Auxiliary On-Us field.",
    width: 8.5,
    height: 3.5,
    page: { width: 8.5, height: 11 },
    perPage: 1,
    offsets: [[0, 0.5]],
    stubs: [
      { x: 0, y: 4.0, width: 8.5, height: 2.875, side: "bottom" },
      { x: 0, y: 6.875, width: 8.5, height: 2.875, side: "bottom" },
    ],
    supportsAuxOnUs: true,
    elements: wideElements,
  },
  business: {
    id: "business",
    name: "Business Draft (8½\" × 3½\")",
    description:
      "Standard single business laser check (8½\" × 3½\") for laser printers, still wide enough for the Auxiliary On-Us serial field.",
    width: 8.5,
    height: 3.5,
    page: { width: 8.5, height: 11 },
    perPage: 1,
    offsets: [
      [0, 0.5],
          ],
    stubs: [{ x: 0, y: 4.0, width: 8.5, height: 2.875, side: "bottom" }],
    supportsAuxOnUs: true,
    elements: wideElements,
  },
};

export const LAYOUT_LIST = Object.values(LAYOUTS);

export function getLayout(id: string): LayoutSpec {
  return LAYOUTS[(id as LayoutId) in LAYOUTS ? (id as LayoutId) : "wallet"];
}
