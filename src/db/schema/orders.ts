import {
  char,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  index,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { DesignDoc } from "@/lib/designEditor";
import type { ReadinessIssue } from "@/lib/designReadiness";
import type { Quote } from "@/lib/orderOfServicePricing";
import { designs } from "./designs";
import { users } from "./users";

/**
 * No separate cart table — a cart is simply an orders row with
 * status = "draft". Order rows are transaction snapshots: the spec/pricing
 * columns below deliberately carry no FK into the catalogue, so a later
 * change to a rate or the removal of a paper stock can never rewrite
 * history. (Contrast with designs.*, which FKs live into the catalogue.)
 *
 * They stay `varchar` slugs, not the catalogue's surrogate int ids, on
 * purpose: a surrogate id is meaningless once its row is gone, whereas
 * "silk"/"order-of-service" stays a readable historical record even then.
 * Don't "fix" these to int to match catalogue.ts/pricing.ts — that would
 * defeat the point of a snapshot.
 */

/**
 * There is no customer proof-approval state here on purpose. Mistakes are
 * caught before payment, at the add-to-basket click (see the pre-order check
 * in src/lib/designReadiness.ts), so a paid order goes straight to the print
 * queue — `awaiting_print` is "paid, not yet sent to press".
 */
export const orderStatusValues = [
  "draft",
  "awaiting_print",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const orders = mysqlTable(
  "orders",
  {
    id: char("id", { length: 36 }).primaryKey(),
    /** Human-facing reference, e.g. TFS-2026-000123. */
    orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
    userId: char("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    guestEmail: varchar("guest_email", { length: 255 }),
    guestToken: char("guest_token", { length: 36 }),
    status: mysqlEnum("status", orderStatusValues).notNull().default("draft"),
    contactName: varchar("contact_name", { length: 200 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 120 }),
    postcode: varchar("postcode", { length: 20 }),
    country: char("country", { length: 2 }).notNull().default("GB"),
    /** Snapshot of the chosen delivery option, not a live FK — see file note. */
    deliveryOptionId: varchar("delivery_option_id", { length: 64 }),
    deliveryLabel: varchar("delivery_label", { length: 200 }),
    deliveryPricePence: int("delivery_price_pence"),
    subtotalPence: int("subtotal_pence").notNull().default(0),
    deliveryPence: int("delivery_pence").notNull().default(0),
    /** The VAT contained within subtotal+delivery — prices are VAT-inclusive. */
    vatPence: int("vat_pence").notNull().default(0),
    vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.2000"),
    totalPence: int("total_pence").notNull().default(0),
    currency: char("currency", { length: 3 }).notNull().default("GBP"),
    placedAt: timestamp("placed_at"),
    /**
     * Stripe Checkout. The session id is set when the customer is sent to
     * pay (a draft with a session is "payment pending"); the intent id and
     * paidAt land when the payment completes and the order is finalised.
     */
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }).unique(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_guest_token_idx").on(t.guestToken),
    index("orders_status_placed_idx").on(t.status, t.placedAt),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: char("id", { length: 36 }).primaryKey(),
    orderId: char("order_id", { length: 36 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** The item outlives a deleted design. */
    designId: char("design_id", { length: 36 }).references(() => designs.id, {
      onDelete: "set null",
    }),
    position: smallint("position").notNull().default(0),
    // Snapshot columns — queryable, immune to catalogue changes. No FK.
    productId: varchar("product_id", { length: 64 }).notNull(),
    templateId: varchar("template_id", { length: 64 }).notNull(),
    quantityOptionId: varchar("quantity_option_id", { length: 64 }),
    sizeOptionId: varchar("size_option_id", { length: 64 }),
    colourOptionId: varchar("colour_option_id", { length: 64 }),
    pageCountOptionId: varchar("page_count_option_id", { length: 64 }),
    paperOptionId: varchar("paper_option_id", { length: 64 }),
    deliveryOptionId: varchar("delivery_option_id", { length: 64 }),
    /**
     * The fully resolved Quote (labels, multipliers, rates) as the customer
     * saw it. Its `delivery` is the order-level option and its `totalPence`
     * therefore includes delivery — `lineTotalPence` below (print cost only)
     * is the authoritative per-line figure. While the order is still a draft
     * this is a placeholder; it is rewritten at the pay click.
     */
    quoteSnapshot: json("quote_snapshot").$type<Quote>().notNull(),
    quantityCopies: int("quantity_copies").notNull(),
    unitPricePence: int("unit_price_pence").notNull(),
    lineTotalPence: int("line_total_pence").notNull(),
    /** The exact DesignDoc sent to press — the design itself stays editable after ordering. */
    docSnapshot: json("doc_snapshot").$type<DesignDoc>().notNull(),
    /**
     * The audit record of the pre-order check: exactly which template
     * placeholders the customer was warned were still unedited, and when they
     * confirmed they meant to keep them. Null means the design tripped no
     * warnings at all, not that the check was skipped — an empty photo window
     * blocks the add outright and never reaches this table.
     *
     * A snapshot like the spec columns above, and for the same reason: it is
     * the evidence for "you approved this wording", so a later edit to the
     * design must never rewrite it.
     */
    defaultsAck: json("defaults_ack").$type<ReadinessIssue[]>(),
    defaultsAckAt: timestamp("defaults_ack_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/**
 * One row per proof *version* — a press artefact, never shown to the
 * customer. Admin-only: staff render it to check what will actually come off
 * the press and to hand the printer a file.
 *
 * pdfUrl/storageKey stay null until someone asks for a PDF; the page images
 * in order_proof_pages below let an admin look at a version without one.
 *
 * docSnapshot is the artwork this version was rendered from, and it is why
 * the column lives here rather than only on order_items. A corrected version
 * needs somewhere to go, and order_items.docSnapshot must not move — that is
 * the frozen record of what was paid for. So v1 carries what they bought,
 * v2 carries the fix.
 */
export const orderProofs = mysqlTable(
  "order_proofs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    orderItemId: char("order_item_id", { length: 36 })
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    version: int("version").notNull(),
    /** The artwork this version shows — see the note above. */
    docSnapshot: json("doc_snapshot").$type<DesignDoc>().notNull(),
    /** Both null until the print PDF is generated for the press. */
    pdfUrl: varchar("pdf_url", { length: 1024 }),
    storageKey: varchar("storage_key", { length: 512 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("order_proofs_item_version_uq").on(t.orderItemId, t.version)],
);

/** The page images the customer actually reviews, one row per page. */
export const orderProofPages = mysqlTable(
  "order_proof_pages",
  {
    id: char("id", { length: 36 }).primaryKey(),
    proofId: char("proof_id", { length: 36 })
      .notNull()
      .references(() => orderProofs.id, { onDelete: "cascade" }),
    pageIndex: smallint("page_index").notNull(),
    imageUrl: varchar("image_url", { length: 1024 }).notNull(),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("order_proof_pages_proof_page_uq").on(t.proofId, t.pageIndex)],
);

export const orderEvents = mysqlTable(
  "order_events",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: char("order_id", { length: 36 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }),
    note: text("note"),
    actor: varchar("actor", { length: 120 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);
