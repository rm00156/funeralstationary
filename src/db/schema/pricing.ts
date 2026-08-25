import {
  boolean,
  decimal,
  int,
  mysqlTable,
  primaryKey,
  smallint,
  varchar,
} from "drizzle-orm/mysql-core";
import { products } from "./catalogue";

/**
 * Pricing tables mirror src/lib/orderOfServicePricing.ts. Every table is
 * keyed by (product_id, id) — only "order-of-service" has rows today, but
 * scoping to a product now avoids a migration when other products get their
 * own rates. designs.* spec columns hold a straight two-column FK into these
 * tables, which is why size/colour/paper each get their own table (a MySQL
 * FK must reference an exact unique key, so a single polymorphic table keyed
 * on (product_id, kind, id) can't be targeted by a plain (product_id, id) FK).
 */

const specOptionColumns = {
  productId: varchar("product_id", { length: 64 })
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  id: varchar("id", { length: 64 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  multiplier: decimal("multiplier", { precision: 6, scale: 4 }).notNull(),
  note: varchar("note", { length: 500 }),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
} as const;

export const sizeOptions = mysqlTable(
  "size_options",
  { ...specOptionColumns },
  (t) => [primaryKey({ columns: [t.productId, t.id] })],
);

export const colourOptions = mysqlTable(
  "colour_options",
  { ...specOptionColumns },
  (t) => [primaryKey({ columns: [t.productId, t.id] })],
);

export const paperOptions = mysqlTable(
  "paper_options",
  { ...specOptionColumns },
  (t) => [primaryKey({ columns: [t.productId, t.id] })],
);

export const quantityOptions = mysqlTable(
  "quantity_options",
  {
    ...specOptionColumns,
    /** Real copy count — QuantityOption.value. */
    copies: int("copies").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.id] })],
);

export const pageCountOptions = mysqlTable(
  "page_count_options",
  {
    productId: varchar("product_id", { length: 64 })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    id: varchar("id", { length: 64 }).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    pageCount: int("page_count").notNull(),
    /** Base per-copy rate (A5, silk, full-colour both sides), in pence. */
    baseRatePence: int("base_rate_pence").notNull(),
    note: varchar("note", { length: 500 }),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.productId, t.id] })],
);

export const deliveryOptions = mysqlTable(
  "delivery_options",
  {
    productId: varchar("product_id", { length: 64 })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    id: varchar("id", { length: 64 }).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    pricePence: int("price_pence").notNull(),
    note: varchar("note", { length: 500 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.productId, t.id] })],
);
