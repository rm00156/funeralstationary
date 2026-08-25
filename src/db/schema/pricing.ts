import {
  boolean,
  decimal,
  int,
  mysqlTable,
  smallint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { products } from "./catalogue";

/**
 * Pricing tables mirror src/lib/orderOfServicePricing.ts. Every table uses a
 * surrogate int PK plus a `slug` (today's human-readable id — "15", "a5",
 * "silk") unique per product. Only "order-of-service" has rows today, but
 * scoping to a product now avoids a migration when other products get their
 * own rates.
 *
 * designs.* spec columns hold a composite FK on (product_id, *_option_id)
 * into these tables — not just *_option_id alone — so a design can only ever
 * reference a pricing row that belongs to its own product. That's why
 * size/colour/paper each get their own table rather than one polymorphic
 * table keyed by kind: a MySQL FK must target an exact unique key, and
 * (product_id, kind, id) can't be targeted by a two-column FK.
 */

const specOptionColumns = {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  slug: varchar("slug", { length: 64 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  multiplier: decimal("multiplier", { precision: 6, scale: 4 }).notNull(),
  note: varchar("note", { length: 500 }),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
} as const;

// (product_id, id) backs the composite FK from the designs table's pricing
// columns; (product_id, slug) is the natural conflict key the seed upserts
// against, and stops two rows for one product reusing the same slug.
export const sizeOptions = mysqlTable("size_options", { ...specOptionColumns }, (t) => [
  uniqueIndex("size_options_product_id_uq").on(t.productId, t.id),
  uniqueIndex("size_options_product_slug_uq").on(t.productId, t.slug),
]);

export const colourOptions = mysqlTable("colour_options", { ...specOptionColumns }, (t) => [
  uniqueIndex("colour_options_product_id_uq").on(t.productId, t.id),
  uniqueIndex("colour_options_product_slug_uq").on(t.productId, t.slug),
]);

export const paperOptions = mysqlTable("paper_options", { ...specOptionColumns }, (t) => [
  uniqueIndex("paper_options_product_id_uq").on(t.productId, t.id),
  uniqueIndex("paper_options_product_slug_uq").on(t.productId, t.slug),
]);

export const quantityOptions = mysqlTable(
  "quantity_options",
  {
    ...specOptionColumns,
    /** Real copy count — QuantityOption.value. */
    copies: int("copies").notNull(),
  },
  (t) => [
    uniqueIndex("quantity_options_product_id_uq").on(t.productId, t.id),
    uniqueIndex("quantity_options_product_slug_uq").on(t.productId, t.slug),
  ],
);

export const pageCountOptions = mysqlTable(
  "page_count_options",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    pageCount: int("page_count").notNull(),
    /** Base per-copy rate (A5, silk, full-colour both sides), in pence. */
    baseRatePence: int("base_rate_pence").notNull(),
    note: varchar("note", { length: 500 }),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("page_count_options_product_id_uq").on(t.productId, t.id),
    uniqueIndex("page_count_options_product_slug_uq").on(t.productId, t.slug),
  ],
);

export const deliveryOptions = mysqlTable(
  "delivery_options",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    pricePence: int("price_pence").notNull(),
    note: varchar("note", { length: 500 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("delivery_options_product_id_uq").on(t.productId, t.id),
    uniqueIndex("delivery_options_product_slug_uq").on(t.productId, t.slug),
  ],
);
