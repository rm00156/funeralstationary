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
import type { Quote } from "@/lib/orderOfServicePricing";
import { designs } from "./designs";
import { users } from "./users";

/**
 * No separate cart table — a cart is simply an orders row with
 * status = "draft". Order rows are transaction snapshots: the spec/pricing
 * columns below deliberately carry no FK into the catalogue, so a later
 * change to a rate or the removal of a paper stock can never rewrite
 * history. (Contrast with designs.*, which FKs live into the catalogue.)
 */

export const orderStatusValues = [
  "draft",
  "awaiting_proof",
  "proof_sent",
  "approved",
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_guest_token_idx").on(t.guestToken),
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
    /** The fully resolved Quote (labels, multipliers, rates) as the customer saw it. */
    quoteSnapshot: json("quote_snapshot").$type<Quote>().notNull(),
    quantityCopies: int("quantity_copies").notNull(),
    unitPricePence: int("unit_price_pence").notNull(),
    lineTotalPence: int("line_total_pence").notNull(),
    /** The exact DesignDoc sent to press — the design itself stays editable after ordering. */
    docSnapshot: json("doc_snapshot").$type<DesignDoc>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderProofStatusValues = [
  "generated",
  "sent",
  "changes_requested",
  "approved",
] as const;

export const orderProofs = mysqlTable(
  "order_proofs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    orderItemId: char("order_item_id", { length: 36 })
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    version: int("version").notNull(),
    pdfUrl: varchar("pdf_url", { length: 1024 }).notNull(),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    status: mysqlEnum("status", orderProofStatusValues).notNull().default("generated"),
    sentAt: timestamp("sent_at"),
    respondedAt: timestamp("responded_at"),
    customerNote: text("customer_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("order_proofs_item_version_uq").on(t.orderItemId, t.version)],
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
