import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  timestamp,
  tinyint,
  varchar,
  char,
} from "drizzle-orm/mysql-core";
import type { DesignPage } from "@/lib/designEditor";
import { PRODUCT_OCCASIONS } from "@/lib/templates";
import { VAT_TREATMENTS } from "@/lib/vat";

/**
 * Catalogue tables use surrogate int PKs (small, fast to join, and these
 * rows are only ever created by our own seed script — never by an untrusted
 * client, unlike users/designs/orders where a UUID makes sense). Each table
 * also carries a `slug` — the same human-readable id already used throughout
 * the app (`order-of-service`, `floral`, `gentle-farewell`, in URLs and
 * src/lib/templates.ts) — as a unique column, not the PK, so business
 * identifiers stay stable and readable without doubling as the join key.
 */

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 200 }).notNull(),
  /** One or two sentences for the product's card. Null = the card has no blurb. */
  description: varchar("description", { length: 300 }),
  /** When it's needed — the shop's grouping. The values live in templates.ts
   * (client-safe) so the admin parser and the menus can't drift from the enum. */
  occasion: mysqlEnum("occasion", PRODUCT_OCCASIONS).notNull().default("service"),
  /*
   * The product's format (ProductFormat in designEditor.ts): the trim every
   * design and template of it is drawn on, how many template pages it
   * authors, and what its axes are called. The defaults are the A5 booklet's.
   * The trim and template pages are fixed once a template exists — a layout
   * is percentages of this trim, so changing it would stretch every one.
   */
  sizeLabel: varchar("size_label", { length: 64 }).notNull().default("A5"),
  trimWidthMm: smallint("trim_width_mm").notNull().default(148),
  trimHeightMm: smallint("trim_height_mm").notNull().default(210),
  /** 1 = front only, 2 = front and back, 3 = cover / middle / back. */
  templatePages: tinyint("template_pages").notNull().default(3),
  /** The page-count options are print sizes of one A-series design (a memory board). */
  sizedByOption: boolean("sized_by_option").notNull().default(false),
  paperLabel: varchar("paper_label", { length: 40 }).notNull().default("Paper"),
  /** How the product (and its delivery) is taxed — see src/lib/vat.ts. Frozen onto order lines at the pay click. */
  vatTreatment: mysqlEnum("vat_treatment", VAT_TREATMENTS).notNull().default("standard"),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const templateCategories = mysqlTable("template_categories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 200 }).notNull(),
  /** Accent colour a template's starter layout uses when this is its first category. */
  accentHex: char("accent_hex", { length: 7 }).notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const templateStatusValues = ["draft", "published", "archived"] as const;

export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  /**
   * A template's starter content (cover / running order / back page, via
   * makeStarterDoc) is specific to one product's format, so this is a plain
   * FK — a template belongs to exactly one product, not many.
   */
  productId: int("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  previewImageUrl: varchar("preview_image_url", { length: 1024 }).notNull(),
  /**
   * An admin's chosen stand-in portrait (`portrait-1`…) for this template's
   * previews. Null = pick automatically from the cover (see
   * placeholderPortraits). Preview-only: never written into a layout.
   */
  placeholderPortrait: varchar("placeholder_portrait", { length: 32 }),
  /**
   * The *published* per-template starter content — what customers actually
   * get. Null means "no layout authored yet": callers fall back to the
   * generic makeStarterDoc(), preserving the pre-authoring behaviour.
   */
  layout: json("layout").$type<DesignPage[]>(),
  /**
   * The admin's work-in-progress copy of `layout`. The authoring editor
   * autosaves here, so reworking a live template never changes what customers
   * see mid-edit; publishing copies this into `layout` and nulls it again.
   * Null therefore means "no unpublished layout changes", NOT "no layout".
   */
  draftLayout: json("draft_layout").$type<DesignPage[]>(),
  status: mysqlEnum("status", templateStatusValues).notNull().default("published"),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const templateCategoryLinks = mysqlTable(
  "template_category_links",
  {
    templateId: int("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    categoryId: int("category_id")
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
