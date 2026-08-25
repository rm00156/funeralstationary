import { sql } from "drizzle-orm";
import {
  char,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { DesignDoc } from "@/lib/designEditor";
import { products, templates } from "./catalogue";
import {
  colourOptions,
  deliveryOptions,
  pageCountOptions,
  paperOptions,
  quantityOptions,
  sizeOptions,
} from "./pricing";
import { users } from "./users";

export const designStatusValues = ["draft", "ready", "ordered", "archived"] as const;

export const designs = mysqlTable(
  "designs",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: char("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }),
    /** Set while a design has no owner yet; claimed (cleared) on registration. */
    guestToken: char("guest_token", { length: 36 }),
    templateId: int("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "restrict" }),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull().default("Untitled design"),
    status: mysqlEnum("status", designStatusValues).notNull().default("draft"),
    /** The DesignDoc — pages of percentage-positioned elements. */
    doc: json("doc").$type<DesignDoc>().notNull(),
    /**
     * Denormalised from doc.pages.length so listing designs never parses
     * the JSON blob. Invariant (enforced app-side, not by MySQL): this must
     * equal pageCountOptions.pageCount for the chosen pageCountOptionId —
     * see withPageCount() in src/lib/designEditor.ts.
     */
    pageCount: smallint("page_count")
      .notNull()
      .generatedAlwaysAs(sql`json_length(\`doc\`, '$.pages')`, { mode: "stored" }),
    quantityOptionId: int("quantity_option_id"),
    sizeOptionId: int("size_option_id"),
    colourOptionId: int("colour_option_id"),
    /**
     * Required, but with no DB-level default: a literal default can't safely
     * hardcode a surrogate id (it depends on seed insertion order), so
     * createDesign() in designs.server.ts resolves the "4 page"/"silk" slugs
     * to this product's option ids and supplies them explicitly on insert.
     */
    pageCountOptionId: int("page_count_option_id").notNull(),
    paperOptionId: int("paper_option_id").notNull(),
    deliveryOptionId: int("delivery_option_id"),
    thumbnailUrl: varchar("thumbnail_url", { length: 1024 }),
    lastOpenedAt: timestamp("last_opened_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("designs_user_updated_idx").on(t.userId, t.updatedAt),
    index("designs_guest_token_idx").on(t.guestToken),
    index("designs_template_idx").on(t.templateId),
    foreignKey({
      columns: [t.productId, t.quantityOptionId],
      foreignColumns: [quantityOptions.productId, quantityOptions.id],
      name: "designs_quantity_option_fk",
    }),
    foreignKey({
      columns: [t.productId, t.sizeOptionId],
      foreignColumns: [sizeOptions.productId, sizeOptions.id],
      name: "designs_size_option_fk",
    }),
    foreignKey({
      columns: [t.productId, t.colourOptionId],
      foreignColumns: [colourOptions.productId, colourOptions.id],
      name: "designs_colour_option_fk",
    }),
    foreignKey({
      columns: [t.productId, t.pageCountOptionId],
      foreignColumns: [pageCountOptions.productId, pageCountOptions.id],
      name: "designs_page_count_option_fk",
    }),
    foreignKey({
      columns: [t.productId, t.paperOptionId],
      foreignColumns: [paperOptions.productId, paperOptions.id],
      name: "designs_paper_option_fk",
    }),
    foreignKey({
      columns: [t.productId, t.deliveryOptionId],
      foreignColumns: [deliveryOptions.productId, deliveryOptions.id],
      name: "designs_delivery_option_fk",
    }),
  ],
);

export const designAssets = mysqlTable(
  "design_assets",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: char("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    designId: char("design_id", { length: 36 }).references(() => designs.id, { onDelete: "set null" }),
    guestToken: char("guest_token", { length: 36 }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: int("byte_size").notNull(),
    width: smallint("width"),
    height: smallint("height"),
    /** sha256 hex, for dedupe. */
    checksum: char("checksum", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("design_assets_design_idx").on(t.designId),
    index("design_assets_guest_token_idx").on(t.guestToken),
  ],
);

export const designVersions = mysqlTable(
  "design_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    designId: char("design_id", { length: 36 })
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    version: int("version").notNull(),
    doc: json("doc").$type<DesignDoc>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("design_versions_design_version_uq").on(t.designId, t.version)],
);
