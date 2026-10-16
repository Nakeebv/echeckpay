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
 * application users. The first seeded user is the platform operator (role
 * 'admin'); every other user is a customer who writes and prints checks.
 * Wallet balance is denormalised here and reconciled against wallet_ledger.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default(""),
  profileAddress: text("profile_address").notNull().default(""),
  profilePhone: text("profile_phone").notNull().default(""),
  accountType: text("account_type").notNull().default("business"), // business | personal
  onboarded: integer("onboarded").notNull().default(0),
  role: text("role").notNull().default("user"), // user | admin
  status: text("status").notNull().default("active"), // active | blocked | deleted
  emailVerified: integer("email_verified").notNull().default(0),
  balanceCents: integer("balance_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Single-use, hashed email tokens: email verification + password recovery.
 */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull(), // verify_email | reset_password
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_hash_idx").on(t.tokenHash)],
);

/**
 * Immutable financial ledger. Balances are denormalised on users and always
 * updated in the same transaction that appends here.
 */
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(), // signed: + credit / - debit
    kind: text("kind").notNull(), // deposit | print_charge | admin_adjust | admin_reset
    /** unique business reference — the idempotency key for financial effects */
    reference: text("reference").notNull().unique(),
    balanceAfterCents: integer("balance_after_cents").notNull(),
    memo: text("memo").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_ledger_user_idx").on(t.userId)],
);

/**
 * NOWPayments deposit orders. money is credited only from verified IPN flow
 * (signature + server-side reconciliation), never from browser redirects.
 */
export const depositOrders = pgTable(
  "deposit_orders",
  {
    id: text("id").primaryKey(), // internal order id (uuid) sent to NOWPayments
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("nowpayments"),
    priceUsdCents: integer("price_usd_cents").notNull(),
    status: text("status").notNull().default("waiting"), // waiting | confirming | confirmed | finished | failed | expired | refunded | underpaid | cancelled
    invoiceId: text("invoice_id").unique(),
    paymentId: text("payment_id").unique(),
    payCurrency: text("pay_currency").notNull().default(""),
    payAmount: text("pay_amount").notNull().default(""),
    actuallyPaid: text("actually_paid").notNull().default(""),
    failureReason: text("failure_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("deposit_orders_user_idx").on(t.userId)],
);

/** every IPN / reconciliation state change — unique per (payment, status). */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: serial("id").primaryKey(),
    paymentId: text("payment_id").notNull(),
    orderId: text("order_id").notNull().default(""),
    status: text("status").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payment_events_uq").on(t.paymentId, t.status)],
);

/** user ↔ support conversations. */
export const supportThreads = pgTable("support_threads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"), // open | answered | closed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => supportThreads.id, { onDelete: "cascade" }),
  authorRole: text("author_role").notNull(), // user | admin
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Object-storage index. One row per stored file; the object key is
 * unpredictable and the row is the only path to authorisation.
 */
export const files = pgTable(
  "files",
  {
    id: text("id").primaryKey(),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    accessLevel: text("access_level").notNull().default("private"), // private | public
    originalName: text("original_name").notNull().default(""),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectKey: text("object_key").notNull().unique(),
    status: text("status").notNull().default("active"), // active | replaced | deleted
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("files_owner_idx").on(t.ownerUserId)],
);

/** one-time tokens that unlock the clean (non-watermarked) print view. */
export const printTokens = pgTable(
  "print_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkId: integer("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("print_tokens_hash_idx").on(t.tokenHash)],
);

/**
 * Bank / drawee accounts. Routing + account numbers feed the MICR line.
 */
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    printCount: integer("print_count").notNull().default(0),
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
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  checkId: integer("check_id").references(() => checks.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  actor: text("actor").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type Payee = typeof payees.$inferSelect;
export type Check = typeof checks.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type DepositOrder = typeof depositOrders.$inferSelect;
export type LedgerEntry = typeof walletLedger.$inferSelect;
export type SupportThread = typeof supportThreads.$inferSelect;
