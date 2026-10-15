import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Bank / drawee accounts. Routing + account numbers feed the MICR line.
 */
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  accountClass: text("account_class").notNull().default("business"), // personal | business
  holderName: text("holder_name").notNull(),
  holderAddress: text("holder_address").notNull().default(""),
  holderPhone: text("holder_phone").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  bankAddress: text("bank_address").notNull().default(""),
  routingNumber: varchar("routing_number", { length: 9 }).notNull(),
  accountNumber: varchar("account_number", { length: 19 }).notNull(),
  fraction: text("fraction").notNull().default(""),
  onUsFormat: text("on_us_format").notNull().default("account-symbol-serial"),
  nextCheckNumber: integer("next_check_number").notNull().default(1001),
  logoDataUrl: text("logo_data_url"),
  /** printed width (inches) of the bank logo on the face — operator adjustable */
  bankLogoWidthIn: real("bank_logo_width_in").notNull().default(1.5),
  /** drawer / company logo (top-left) — uploaded per account */
  companyLogoDataUrl: text("company_logo_data_url"),
  companyLogoWidthIn: real("company_logo_width_in").notNull().default(1.2),
  signatureDataUrl: text("signature_data_url"),
  signatureText: text("signature_text").notNull().default(""),
  signatureTitle: text("signature_title").notNull().default("Authorized Signature"),
  background: text("background").notNull().default("sky"),
  micrRenderer: text("micr_renderer").notNull().default("font"),
  micrFontDataUrl: text("micr_font_data_url"),
  micrFontSizePt: real("micr_font_size_pt").notNull().default(12),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payees = pgTable("payees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  isBusiness: boolean("is_business").notNull().default(false),
  defaultMemo: text("default_memo").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checks = pgTable(
  "checks",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    payeeId: integer("payee_id").references(() => payees.id, { onDelete: "set null" }),
    checkNumber: integer("check_number").notNull(),
    payeeName: text("payee_name").notNull(),
    payeeAddress: text("payee_address").notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    dateIssued: date("date_issued").notNull(),
    memo: text("memo").notNull().default(""),
    layout: text("layout").notNull().default("wallet"),
    status: text("status").notNull().default("draft"), // draft | printed | issued | cleared | void | stopped
    /** reason captured for void / stop-payment, shown on the audit trail */
    statusReason: text("status_reason").notNull().default(""),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    signatureMode: text("signature_mode").notNull().default("facsimile"), // none | facsimile | image
    includeAmountField: boolean("include_amount_field").notNull().default(false),
    background: text("background").notNull().default("sky"),
    printedAt: timestamp("printed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Serials are gapless AND unique per account — enforced by the database, not
    // by a check-then-insert race.
    uniqueIndex("checks_account_serial_uq").on(t.accountId, t.checkNumber),
    index("checks_account_idx").on(t.accountId),
  ],
);

/**
 * Tamper-evident audit trail — every state change on a check is recorded.
 * Rows are never deleted with the check (FK set-null preserves the record).
 */
export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  checkId: integer("check_id").references(() => checks.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  actor: text("actor").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type Payee = typeof payees.$inferSelect;
export type Check = typeof checks.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
