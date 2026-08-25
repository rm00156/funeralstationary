import {
  boolean,
  char,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import type { DesignPage } from "@/lib/designEditor";

/**
 * Catalogue tables are keyed by the same human-readable slugs already used
 * throughout the app (`order-of-service`, `floral`, `gentle-farewell`, ...) —
 * see src/lib/templates.ts. URLs and `DesignDoc.templateId` already carry
 * these slugs, so seeding is a direct transcription with no id-translation
 * layer required.
 */

export const products = mysqlTable("products", {
  id: varchar("id", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 200 }).notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const templateCategories = mysqlTable("template_categories", {
  id: varchar("id", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 200 }).notNull(),
  /** Accent colour a template's starter layout uses when this is its first category. */
  accentHex: char("accent_hex", { length: 7 }).notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const templateStatusValues = ["draft", "published", "archived"] as const;

export const templates = mysqlTable("templates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  previewImageUrl: varchar("preview_image_url", { length: 1024 }).notNull(),
  /**
   * Real per-template starter content. Null means "no layout authored yet" —
   * callers fall back to the generic makeStarterDoc(), preserving today's
   * behaviour until real layouts are filled in.
   */
  layout: json("layout").$type<DesignPage[]>(),
  status: mysqlEnum("status", templateStatusValues).notNull().default("published"),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const templateCategoryLinks = mysqlTable(
  "template_category_links",
  {
    templateId: varchar("template_id", { length: 64 })
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    categoryId: varchar("category_id", { length: 64 })
      .notNull()
      .references(() => templateCategories.id, { onDelete: "restrict" }),
    /**
     * Array order in Template.categories is load-bearing: templateAccent()
     * takes the first matching category, so order must survive the move to
     * a join table.
     */
    position: smallint("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.categoryId] })],
);

export const templateProductLinks = mysqlTable(
  "template_product_links",
  {
    templateId: varchar("template_id", { length: 64 })
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    productId: varchar("product_id", { length: 64 })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.productId] })],
);
