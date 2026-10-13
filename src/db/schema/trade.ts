import {
  boolean,
  char,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Trade customers: funeral directors and others ordering for families.
 * A firm is set up by a person after its /trade application, in
 * /admin/trade — nothing here is created by a visitor, which is why it uses
 * an int surrogate key like the catalogue.
 *
 * Retire, don't delete: `is_active = false` turns a firm's trade view off
 * while its orders keep pointing at it.
 */
export const tradeFirms = mysqlTable("trade_firms", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 160 }).notNull(),
  /**
   * The net terms agreed with the firm, in days after invoice. Recorded now
   * for when trade orders go on account; nothing charges on it yet.
   */
  paymentTermsDays: smallint("payment_terms_days"),
  /**
   * The firm's trade discount, a percentage taken off every print price its
   * people see and pay (never delivery) — applied where prices are loaded
   * (pricing.server.ts), so no page can show a different price. 0 = none.
   */
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  /**
   * May order on account: checkout offers "Place order on account", the
   * order goes to print unpaid, and Thintent invoices it on
   * `payment_terms_days` net terms. Off = trade prices, card at checkout.
   */
  onAccount: boolean("on_account").notNull().default(false),
  /** Where Thintent sends the firm's invoices; null = to whoever placed the order. */
  accountsEmail: varchar("accounts_email", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

/**
 * The people at a firm, by email. Signing in is unchanged (the emailed link,
 * src/lib/auth.server.ts); an account whose proven email is listed here sees
 * the trade view of /account. Keyed by email, not by `users`, because a
 * firm's people are added before they have ever signed in — like `admins`.
 * One address belongs to one firm.
 */
export const tradeMembers = mysqlTable(
  "trade_members",
  {
    id: int("id").primaryKey().autoincrement(),
    firmId: int("firm_id")
      .notNull()
      .references(() => tradeFirms.id, { onDelete: "cascade" }),
    /** Lowercased, like users.email. */
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 120 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("trade_members_firm_idx").on(t.firmId)],
);

export const TRADE_APPLICATION_STATUSES = ["pending", "approved", "declined"] as const;
export type TradeApplicationStatus = (typeof TRADE_APPLICATION_STATUSES)[number];

/**
 * A /trade application, exactly as it was sent (tradeApplication.ts
 * validates it). Written by a visitor, so a UUID key like designs and
 * orders. It is the record — the email to the shop is only a heads-up — and
 * an admin approves it into a firm or declines it in /admin/trade.
 *
 * Pending → approved or declined, once, by a conditional update; nothing
 * moves it back. The fields are a snapshot: approving copies them onto the
 * firm and its member, and a later edit to either leaves this as sent.
 */
export const tradeApplications = mysqlTable(
  "trade_applications",
  {
    id: char("id", { length: 36 }).primaryKey(),
    status: mysqlEnum("status", TRADE_APPLICATION_STATUSES).notNull().default("pending"),
    businessName: varchar("business_name", { length: 160 }).notNull(),
    postcode: varchar("postcode", { length: 10 }).notNull(),
    contactName: varchar("contact_name", { length: 120 }).notNull(),
    role: varchar("role", { length: 120 }).notNull(),
    /** Lowercased, as trade_members.email is. */
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    /** The labels as the applicant saw them. */
    volume: varchar("volume", { length: 60 }).notNull(),
    orders: json("orders").$type<string[]>().notNull(),
    notes: text("notes"),
    /** The firm it was approved into (new or existing); null until approved. */
    firmId: int("firm_id").references(() => tradeFirms.id, { onDelete: "set null" }),
    /** The admin who decided, a snapshot like admins.added_by. */
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: timestamp("decided_at"),
    /** Staff-only: why it was declined, or anything worth remembering. */
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("trade_applications_status_idx").on(t.status, t.createdAt)],
);
