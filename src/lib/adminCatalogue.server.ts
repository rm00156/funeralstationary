/**
 * Server-side admin reads/writes for the catalogue and pricing tables.
 *
 * The admin counterpart of catalogue.server.ts / pricing.server.ts: same
 * slug-only discipline (surrogate ids never escape), but nothing is filtered
 * by is_active/status — the admin sees and edits everything. Slugs are
 * immutable after create (they're snapshot keys in order history), so no
 * update below ever touches a slug column.
 *
 * Rows are retired, not deleted: designs FK into every one of these tables
 * with ON DELETE RESTRICT, so is_active = false (or status = "archived" for
 * templates) is how a catalogue row leaves the shop. The single exception is
 * adminDeleteTemplate below, for a template nothing has ever referenced.
 */
import { asc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  designs,
  deliveryOptions,
  pageCountOptions,
  paperOptions,
  products,
  quantityOptions,
  sizeOptions,
  templateCategories,
  templateCategoryLinks,
  templates,
} from "@/db/schema";
import { formatSizesError, parseLayoutPages, type TemplateStatus } from "@/lib/adminValidation";
import { productFormatColumns } from "@/lib/catalogue.server";
import { toProductFormat, type DesignPage, type ProductFormat } from "@/lib/designEditor";
import type { ProductOccasion } from "@/lib/templates";
import type { VatTreatment } from "@/lib/vat";

// Re-exported for the admin routes; the helpers themselves live in
// src/db/errors.ts so the orders seam can share them without importing the
// admin module.
import { isRowReferencedError } from "@/db/errors";

export { isDuplicateKeyError } from "@/db/errors";

async function resolveProductId(slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface AdminProduct {
  slug: string;
  label: string;
  description: string | null;
  occasion: ProductOccasion;
  /** How the product is taxed — frozen onto each order line at the pay click. */
  vatTreatment: VatTreatment;
  sortOrder: number;
  isActive: boolean;
  /** The format columns, flat as they're edited (ProductFormatRow). */
  sizeLabel: string;
  trimWidthMm: number;
  trimHeightMm: number;
  templatePages: number;
  sizedByOption: boolean;
  paperLabel: string;
  /**
   * Templates of any status. Once there is one, the trim and template pages
   * are fixed — its layout is percentages of them.
   */
  templateCount: number;
  /** Published templates — a product needs one (and pricing) before customers see it. */
  publishedTemplateCount: number;
}

/** The format columns an admin may only change while a product has no templates. */
export type LockedFormatField = "trimWidthMm" | "trimHeightMm" | "templatePages";

const productSelection = {
  slug: products.slug,
  label: products.label,
  description: products.description,
  occasion: products.occasion,
  vatTreatment: products.vatTreatment,
  sortOrder: products.sortOrder,
  isActive: products.isActive,
  ...productFormatColumns,
  templateCount: sql<number>`(select count(*) from ${templates} where ${templates.productId} = ${products.id})`,
  publishedTemplateCount: sql<number>`(select count(*) from ${templates} where ${templates.productId} = ${products.id} and ${templates.status} = 'published')`,
};

/** count(*) arrives as a string from mysql2. */
const withCount = <T extends { templateCount: number | string; publishedTemplateCount: number | string }>(
  row: T,
) => ({
  ...row,
  templateCount: Number(row.templateCount),
  publishedTemplateCount: Number(row.publishedTemplateCount),
});

export async function adminListProducts(): Promise<AdminProduct[]> {
  const rows = await db
    .select(productSelection)
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.id));
  return rows.map(withCount);
}

export async function adminGetProduct(slug: string): Promise<AdminProduct | null> {
  const [row] = await db
    .select(productSelection)
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return row ? withCount(row) : null;
}

/** A new product goes to the end of the range unless a sort order is given. */
export async function adminCreateProduct(input: {
  slug: string;
  label: string;
  occasion?: ProductOccasion;
  vatTreatment?: VatTreatment;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<AdminProduct> {
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [row] = await db
      .select({ last: sql<number | null>`max(${products.sortOrder})` })
      .from(products);
    sortOrder = row?.last == null ? 0 : Number(row.last) + 1;
  }
  await db.insert(products).values({ ...input, sortOrder });
  return (await adminGetProduct(input.slug))!;
}

/**
 * Renumber the whole range in the order given (0, 1, 2, …). The list must
 * name every product exactly once — anything else means the admin was
 * looking at a list that has since changed, and false is returned.
 */
export async function adminReorderProducts(slugs: string[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx.select({ slug: products.slug }).from(products).for("update");
    const known = new Set(rows.map((row) => row.slug));
    if (rows.length !== slugs.length || !slugs.every((slug) => known.has(slug))) return false;
    for (const [index, slug] of slugs.entries()) {
      await tx.update(products).set({ sortOrder: index }).where(eq(products.slug, slug));
    }
    return true;
  });
}

export async function adminUpdateProduct(
  slug: string,
  patch: {
    label?: string;
    description?: string | null;
    occasion?: ProductOccasion;
    vatTreatment?: VatTreatment;
    sortOrder?: number;
    isActive?: boolean;
    sizeLabel?: string;
    trimWidthMm?: number;
    trimHeightMm?: number;
    templatePages?: number;
    sizedByOption?: boolean;
    paperLabel?: string;
  },
): Promise<AdminProduct | { locked: LockedFormatField[] } | { sizeConflict: string } | null> {
  const existing = await adminGetProduct(slug);
  if (!existing) return null;
  // Changing the trim or the page structure under existing templates would
  // stretch or orphan every layout. A same-value write is not a change.
  const locked = (["trimWidthMm", "trimHeightMm", "templatePages"] as const).filter(
    (field) => patch[field] !== undefined && patch[field] !== existing[field],
  );
  if (locked.length > 0 && existing.templateCount > 0) return { locked };
  if (patch.trimWidthMm !== undefined || patch.trimHeightMm !== undefined || patch.sizedByOption !== undefined) {
    const activeSizes = await db
      .select({ label: sizeOptions.label, widthMm: sizeOptions.widthMm, heightMm: sizeOptions.heightMm })
      .from(sizeOptions)
      .innerJoin(products, eq(products.id, sizeOptions.productId))
      .where(and(eq(products.slug, slug), eq(sizeOptions.isActive, true)));
    const sizeConflict = formatSizesError({ ...existing, ...patch }, activeSizes);
    if (sizeConflict) return { sizeConflict };
  }
  await db.update(products).set(patch).where(eq(products.slug, slug));
  return adminGetProduct(slug);
}

/* ------------------------------------------------------------------ */
/* Pricing options                                                     */
/* ------------------------------------------------------------------ */

export const OPTION_KINDS = [
  "paper",
  "quantity",
  "page-count",
  "delivery",
  "size",
] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

export function isOptionKind(value: unknown): value is OptionKind {
  return OPTION_KINDS.includes(value as OptionKind);
}

/** One row of any pricing table; kind decides which optionals are present. */
export interface AdminOption {
  slug: string;
  label: string;
  note: string | null;
  sortOrder: number;
  isActive: boolean;
  multiplier?: number;
  copies?: number;
  pageCount?: number;
  baseRatePence?: number;
  pricePence?: number;
  widthMm?: number;
  heightMm?: number;
}

/** Create payload — the route validates and narrows before calling in. */
export interface AdminOptionInput {
  slug: string;
  label: string;
  note: string | null;
  sortOrder: number;
  /** decimal(6,4) string, e.g. "0.9000" — paper/quantity/size only. */
  multiplier?: string;
  copies?: number;
  pageCount?: number;
  baseRatePence?: number;
  pricePence?: number;
  widthMm?: number;
  heightMm?: number;
}

export type AdminOptionPatch = Partial<{
  label: string;
  note: string | null;
  sortOrder: number;
  isActive: boolean;
  multiplier: string;
  copies: number;
  pageCount: number;
  baseRatePence: number;
  pricePence: number;
  widthMm: number;
  heightMm: number;
}>;

export async function adminListOptions(
  productSlug: string,
  kind: OptionKind,
): Promise<AdminOption[] | null> {
  const productId = await resolveProductId(productSlug);
  if (!productId) return null;

  if (kind === "paper") {
    const table = paperOptions;
    const rows = await db
      .select({
        slug: table.slug,
        label: table.label,
        note: table.note,
        sortOrder: table.sortOrder,
        isActive: table.isActive,
        multiplier: table.multiplier,
      })
      .from(table)
      .where(eq(table.productId, productId))
      .orderBy(asc(table.sortOrder), asc(table.id));
    return rows.map((row) => ({ ...row, multiplier: Number(row.multiplier) }));
  }

  if (kind === "quantity") {
    const rows = await db
      .select({
        slug: quantityOptions.slug,
        label: quantityOptions.label,
        note: quantityOptions.note,
        sortOrder: quantityOptions.sortOrder,
        isActive: quantityOptions.isActive,
        multiplier: quantityOptions.multiplier,
        copies: quantityOptions.copies,
      })
      .from(quantityOptions)
      .where(eq(quantityOptions.productId, productId))
      .orderBy(asc(quantityOptions.sortOrder), asc(quantityOptions.id));
    return rows.map((row) => ({ ...row, multiplier: Number(row.multiplier) }));
  }

  if (kind === "size") {
    const rows = await db
      .select({
        slug: sizeOptions.slug,
        label: sizeOptions.label,
        note: sizeOptions.note,
        sortOrder: sizeOptions.sortOrder,
        isActive: sizeOptions.isActive,
        multiplier: sizeOptions.multiplier,
        widthMm: sizeOptions.widthMm,
        heightMm: sizeOptions.heightMm,
      })
      .from(sizeOptions)
      .where(eq(sizeOptions.productId, productId))
      .orderBy(asc(sizeOptions.sortOrder), asc(sizeOptions.id));
    return rows.map((row) => ({ ...row, multiplier: Number(row.multiplier) }));
  }

  if (kind === "page-count") {
    return db
      .select({
        slug: pageCountOptions.slug,
        label: pageCountOptions.label,
        note: pageCountOptions.note,
        sortOrder: pageCountOptions.sortOrder,
        isActive: pageCountOptions.isActive,
        pageCount: pageCountOptions.pageCount,
        baseRatePence: pageCountOptions.baseRatePence,
      })
      .from(pageCountOptions)
      .where(eq(pageCountOptions.productId, productId))
      .orderBy(asc(pageCountOptions.sortOrder), asc(pageCountOptions.id));
  }

  return db
    .select({
      slug: deliveryOptions.slug,
      label: deliveryOptions.label,
      note: deliveryOptions.note,
      sortOrder: deliveryOptions.sortOrder,
      isActive: deliveryOptions.isActive,
      pricePence: deliveryOptions.pricePence,
    })
    .from(deliveryOptions)
    .where(eq(deliveryOptions.productId, productId))
    .orderBy(asc(deliveryOptions.sortOrder), asc(deliveryOptions.id));
}

async function getOption(
  productSlug: string,
  kind: OptionKind,
  optionSlug: string,
): Promise<AdminOption | null> {
  const all = await adminListOptions(productSlug, kind);
  return all?.find((option) => option.slug === optionSlug) ?? null;
}

export async function adminCreateOption(
  productSlug: string,
  kind: OptionKind,
  input: AdminOptionInput,
): Promise<AdminOption | null> {
  const productId = await resolveProductId(productSlug);
  if (!productId) return null;

  const base = {
    productId,
    slug: input.slug,
    label: input.label,
    note: input.note,
    sortOrder: input.sortOrder,
  };
  if (kind === "paper") {
    await db
      .insert(paperOptions)
      .values({ ...base, multiplier: input.multiplier! });
  } else if (kind === "quantity") {
    await db
      .insert(quantityOptions)
      .values({ ...base, multiplier: input.multiplier!, copies: input.copies! });
  } else if (kind === "size") {
    await db.insert(sizeOptions).values({
      ...base,
      multiplier: input.multiplier!,
      widthMm: input.widthMm!,
      heightMm: input.heightMm!,
    });
  } else if (kind === "page-count") {
    await db.insert(pageCountOptions).values({
      ...base,
      pageCount: input.pageCount!,
      baseRatePence: input.baseRatePence!,
    });
  } else {
    await db.insert(deliveryOptions).values({
      ...base,
      note: input.note ?? "",
      pricePence: input.pricePence!,
    });
  }
  return getOption(productSlug, kind, input.slug);
}

export async function adminUpdateOption(
  productSlug: string,
  kind: OptionKind,
  optionSlug: string,
  patch: AdminOptionPatch,
): Promise<AdminOption | null> {
  const productId = await resolveProductId(productSlug);
  if (!productId) return null;
  const existing = await getOption(productSlug, kind, optionSlug);
  if (!existing) return null;

  const base = {
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
  };
  // Every table but delivery allows a null note; delivery's is NOT NULL (the
  // route rejects nulling it, so dropping it here is belt-and-braces).
  const nullableNote = patch.note !== undefined ? { note: patch.note } : {};

  if (kind === "paper") {
    const table = paperOptions;
    await db
      .update(table)
      .set({
        ...base,
        ...nullableNote,
        ...(patch.multiplier !== undefined ? { multiplier: patch.multiplier } : {}),
      })
      .where(and(eq(table.productId, productId), eq(table.slug, optionSlug)));
  } else if (kind === "quantity") {
    await db
      .update(quantityOptions)
      .set({
        ...base,
        ...nullableNote,
        ...(patch.multiplier !== undefined ? { multiplier: patch.multiplier } : {}),
        ...(patch.copies !== undefined ? { copies: patch.copies } : {}),
      })
      .where(and(eq(quantityOptions.productId, productId), eq(quantityOptions.slug, optionSlug)));
  } else if (kind === "size") {
    await db
      .update(sizeOptions)
      .set({
        ...base,
        ...nullableNote,
        ...(patch.multiplier !== undefined ? { multiplier: patch.multiplier } : {}),
        ...(patch.widthMm !== undefined ? { widthMm: patch.widthMm } : {}),
        ...(patch.heightMm !== undefined ? { heightMm: patch.heightMm } : {}),
      })
      .where(and(eq(sizeOptions.productId, productId), eq(sizeOptions.slug, optionSlug)));
  } else if (kind === "page-count") {
    await db
      .update(pageCountOptions)
      .set({
        ...base,
        ...nullableNote,
        ...(patch.pageCount !== undefined ? { pageCount: patch.pageCount } : {}),
        ...(patch.baseRatePence !== undefined ? { baseRatePence: patch.baseRatePence } : {}),
      })
      .where(and(eq(pageCountOptions.productId, productId), eq(pageCountOptions.slug, optionSlug)));
  } else {
    await db
      .update(deliveryOptions)
      .set({
        ...base,
        ...(typeof patch.note === "string" ? { note: patch.note } : {}),
        ...(patch.pricePence !== undefined ? { pricePence: patch.pricePence } : {}),
      })
      .where(and(eq(deliveryOptions.productId, productId), eq(deliveryOptions.slug, optionSlug)));
  }

  return getOption(productSlug, kind, optionSlug);
}

const OPTION_TABLES = {
  paper: paperOptions,
  quantity: quantityOptions,
  "page-count": pageCountOptions,
  delivery: deliveryOptions,
  size: sizeOptions,
} as const;

/**
 * Renumber one product's options of a kind in the order given (0, 1, 2, …)
 * — the first active one is the customer's default. The list must name
 * every option of that kind exactly once, or false is returned (the admin
 * was looking at a list that has since changed). Null for an unknown product.
 */
export async function adminReorderOptions(
  productSlug: string,
  kind: OptionKind,
  slugs: string[],
): Promise<boolean | null> {
  const productId = await resolveProductId(productSlug);
  if (!productId) return null;
  // Every option table has the same product_id / slug / sort_order columns.
  const table = OPTION_TABLES[kind] as typeof paperOptions;
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ slug: table.slug })
      .from(table)
      .where(eq(table.productId, productId))
      .for("update");
    const known = new Set(rows.map((row) => row.slug));
    if (rows.length !== slugs.length || !slugs.every((slug) => known.has(slug))) return false;
    for (const [index, slug] of slugs.entries()) {
      await tx
        .update(table)
        .set({ sortOrder: index })
        .where(and(eq(table.productId, productId), eq(table.slug, slug)));
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Template categories                                                 */
/* ------------------------------------------------------------------ */

export interface AdminCategory {
  slug: string;
  label: string;
  accentHex: string;
  sortOrder: number;
  isActive: boolean;
}

const categorySelection = {
  slug: templateCategories.slug,
  label: templateCategories.label,
  accentHex: templateCategories.accentHex,
  sortOrder: templateCategories.sortOrder,
  isActive: templateCategories.isActive,
};

export async function adminListCategories(): Promise<AdminCategory[]> {
  return db
    .select(categorySelection)
    .from(templateCategories)
    .orderBy(asc(templateCategories.sortOrder), asc(templateCategories.id));
}

async function adminGetCategory(slug: string): Promise<AdminCategory | null> {
  const [row] = await db
    .select(categorySelection)
    .from(templateCategories)
    .where(eq(templateCategories.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function adminCreateCategory(input: {
  slug: string;
  label: string;
  accentHex: string;
  sortOrder: number;
}): Promise<AdminCategory> {
  await db.insert(templateCategories).values(input);
  return (await adminGetCategory(input.slug))!;
}

export async function adminUpdateCategory(
  slug: string,
  patch: { label?: string; accentHex?: string; sortOrder?: number; isActive?: boolean },
): Promise<AdminCategory | null> {
  const existing = await adminGetCategory(slug);
  if (!existing) return null;
  await db.update(templateCategories).set(patch).where(eq(templateCategories.slug, slug));
  return adminGetCategory(slug);
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export interface AdminTemplate {
  slug: string;
  name: string;
  productSlug: string;
  /** The product's format — the trim and page structure its layout is drawn on. */
  productFormat: ProductFormat;
  previewImageUrl: string;
  /** Admin-chosen stand-in portrait id, or null for the automatic pick. */
  placeholderPortrait: string | null;
  status: TemplateStatus;
  sortOrder: number;
  /** Category slugs in position order. */
  categories: string[];
  /** True when draft_layout holds edits not yet published to customers. */
  hasDraftLayout: boolean;
  updatedAt: Date;
}

async function loadTemplateCategories(): Promise<Map<number, string[]>> {
  const rows = await db
    .select({
      templateId: templateCategoryLinks.templateId,
      slug: templateCategories.slug,
    })
    .from(templateCategoryLinks)
    .innerJoin(
      templateCategories,
      eq(templateCategoryLinks.categoryId, templateCategories.id),
    )
    .orderBy(asc(templateCategoryLinks.position));
  const byTemplate = new Map<number, string[]>();
  for (const row of rows) {
    const list = byTemplate.get(row.templateId) ?? [];
    list.push(row.slug);
    byTemplate.set(row.templateId, list);
  }
  return byTemplate;
}

const templateSelection = {
  id: templates.id,
  slug: templates.slug,
  name: templates.name,
  productSlug: products.slug,
  ...productFormatColumns,
  previewImageUrl: templates.previewImageUrl,
  placeholderPortrait: templates.placeholderPortrait,
  status: templates.status,
  sortOrder: templates.sortOrder,
  // Tested in SQL rather than selected: a listing only needs to know whether
  // there are unpublished changes, not haul every template's layout blob.
  hasDraftLayout: sql<number>`(${templates.draftLayout} is not null)`,
  updatedAt: templates.updatedAt,
};

type TemplateRow = {
  id: number;
  slug: string;
  name: string;
  productSlug: string;
  sizeLabel: string;
  trimWidthMm: number;
  trimHeightMm: number;
  templatePages: number;
  sizedByOption: boolean;
  paperLabel: string;
  previewImageUrl: string;
  placeholderPortrait: string | null;
  status: TemplateStatus;
  sortOrder: number;
  hasDraftLayout: number;
  updatedAt: Date;
};

function toAdminTemplate(
  row: TemplateRow,
  categoriesByTemplate: Map<number, string[]>,
): AdminTemplate {
  const {
    id,
    hasDraftLayout,
    sizeLabel,
    trimWidthMm,
    trimHeightMm,
    templatePages,
    sizedByOption,
    paperLabel,
    ...rest
  } = row;
  return {
    ...rest,
    productFormat: toProductFormat({
      sizeLabel,
      trimWidthMm,
      trimHeightMm,
      templatePages,
      sizedByOption,
      paperLabel,
    }),
    hasDraftLayout: !!hasDraftLayout,
    categories: categoriesByTemplate.get(id) ?? [],
  };
}

export async function adminListTemplates(): Promise<AdminTemplate[]> {
  const [rows, categoriesByTemplate] = await Promise.all([
    db
      .select(templateSelection)
      .from(templates)
      .innerJoin(products, eq(templates.productId, products.id))
      .orderBy(asc(templates.sortOrder), asc(templates.id)),
    loadTemplateCategories(),
  ]);
  return rows.map((row) => toAdminTemplate(row, categoriesByTemplate));
}

export async function adminGetTemplate(slug: string): Promise<
  | (AdminTemplate & {
      /** The live layout customers get; null = generic starter pages. */
      layout: DesignPage[] | null;
      /** Unpublished edits; null = the draft matches what's live. */
      draftLayout: DesignPage[] | null;
    })
  | null
> {
  const [row] = await db
    .select({
      ...templateSelection,
      layout: templates.layout,
      draftLayout: templates.draftLayout,
    })
    .from(templates)
    .innerJoin(products, eq(templates.productId, products.id))
    .where(eq(templates.slug, slug))
    .limit(1);
  if (!row) return null;
  const categoriesByTemplate = await loadTemplateCategories();
  const { layout, draftLayout, ...rest } = row;
  return {
    ...toAdminTemplate(rest, categoriesByTemplate),
    layout: layout ?? null,
    draftLayout: draftLayout ?? null,
  };
}

/** Replace a template's category links (order = position). seed.ts pattern. */
async function setTemplateCategories(templateId: number, categorySlugs: string[]) {
  const links: { templateId: number; categoryId: number; position: number }[] = [];
  for (const [position, categorySlug] of categorySlugs.entries()) {
    const [category] = await db
      .select({ id: templateCategories.id })
      .from(templateCategories)
      .where(eq(templateCategories.slug, categorySlug))
      .limit(1);
    if (!category) throw new Error(`Unknown category "${categorySlug}"`);
    links.push({ templateId, categoryId: category.id, position });
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(templateCategoryLinks)
      .where(eq(templateCategoryLinks.templateId, templateId));
    if (links.length > 0) await tx.insert(templateCategoryLinks).values(links);
  });
}

async function resolveTemplateId(slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: templates.id })
    .from(templates)
    .where(eq(templates.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

export async function adminCreateTemplate(input: {
  slug: string;
  name: string;
  productSlug: string;
  previewImageUrl: string;
  status: TemplateStatus;
  sortOrder: number;
  categories: string[];
}): Promise<AdminTemplate> {
  const productId = await resolveProductId(input.productSlug);
  if (!productId) throw new Error(`Unknown product "${input.productSlug}"`);
  await db.insert(templates).values({
    slug: input.slug,
    name: input.name,
    productId,
    previewImageUrl: input.previewImageUrl,
    status: input.status,
    sortOrder: input.sortOrder,
    layout: null,
    draftLayout: null,
  });
  const templateId = (await resolveTemplateId(input.slug))!;
  await setTemplateCategories(templateId, input.categories);
  return (await adminGetTemplate(input.slug))!;
}

/** A template product move that would break designs or layouts already made. */
export class TemplateMoveError extends Error {}

/**
 * A template can change product only while nothing depends on where it is.
 * Its designs carry their product's id and trim, so once one exists the
 * template stays put (which also keeps adminUpdateProduct's format lock
 * honest: a product with designs always has a template). And an authored
 * layout is drawn on its product's trim and page structure, so it may only
 * move to a product with the same ones.
 */
async function assertTemplateCanMove(
  templateId: number,
  template: Pick<AdminTemplate, "productSlug" | "productFormat"> & {
    layout: DesignPage[] | null;
    draftLayout: DesignPage[] | null;
  },
  target: AdminProduct,
) {
  const [used] = await db
    .select({ count: sql<number>`count(*)` })
    .from(designs)
    .where(eq(designs.templateId, templateId));
  if (Number(used?.count ?? 0) > 0) {
    throw new TemplateMoveError(
      "This template already has customer designs, which belong to its product — it can't move to another.",
    );
  }
  const { trim, templatePages } = template.productFormat;
  const sameFormat =
    target.trimWidthMm === trim.widthMm &&
    target.trimHeightMm === trim.heightMm &&
    target.templatePages === templatePages;
  if ((template.layout || template.draftLayout) && !sameFormat) {
    throw new TemplateMoveError(
      `This template's layout is drawn for ${template.productSlug}'s size and pages; it can only move to a product with the same format.`,
    );
  }
}

export async function adminUpdateTemplate(
  slug: string,
  patch: {
    name?: string;
    productSlug?: string;
    previewImageUrl?: string;
    /** null clears the choice back to the automatic pick. */
    placeholderPortrait?: string | null;
    status?: TemplateStatus;
    sortOrder?: number;
    categories?: string[];
  },
): Promise<AdminTemplate | null> {
  const templateId = await resolveTemplateId(slug);
  if (!templateId) return null;

  let productId: number | undefined;
  if (patch.productSlug !== undefined) {
    const resolved = await resolveProductId(patch.productSlug);
    if (!resolved) throw new Error(`Unknown product "${patch.productSlug}"`);
    const existing = await adminGetTemplate(slug);
    if (existing && existing.productSlug !== patch.productSlug) {
      await assertTemplateCanMove(templateId, existing, (await adminGetProduct(patch.productSlug))!);
      productId = resolved;
    }
  }

  const set = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(productId !== undefined ? { productId } : {}),
    ...(patch.previewImageUrl !== undefined
      ? { previewImageUrl: patch.previewImageUrl }
      : {}),
    ...(patch.placeholderPortrait !== undefined
      ? { placeholderPortrait: patch.placeholderPortrait }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
  };
  if (Object.keys(set).length > 0) {
    await db.update(templates).set(set).where(eq(templates.id, templateId));
  }
  if (patch.categories !== undefined) {
    await setTemplateCategories(templateId, patch.categories);
  }
  return adminGetTemplate(slug);
}

/**
 * Hard-delete a template — the one exception to this module's retire-don't-
 * delete rule, for a template nothing has ever used. A bulk-generated draft
 * that didn't make the cut would otherwise sit in /admin/templates forever:
 * archiving is the right answer for a template with history, but there is no
 * history here to protect.
 *
 * The guard is the FK that would refuse the delete anyway, checked up front so
 * the UI can explain itself rather than surface a MySQL error: any `designs`
 * row pointing here blocks it — soft-deleted ones included, since deleted_at
 * leaves the row, and so the constraint, in place. That transitively covers
 * order history too, because a template can only reach an order through a
 * design. Anything with designs gets archived instead.
 *
 * The preview image is deliberately left in object storage: an orphaned
 * thumbnail costs nothing, and blindly deleting one risks pulling the rug from
 * under another row pointed at the same URL.
 */
export async function adminDeleteTemplate(
  slug: string,
): Promise<
  | { status: "deleted" }
  | { status: "not-found" }
  | { status: "in-use"; designCount: number }
> {
  const templateId = await resolveTemplateId(slug);
  if (!templateId) return { status: "not-found" };

  const [used] = await db
    .select({ count: sql<number>`count(*)` })
    .from(designs)
    .where(eq(designs.templateId, templateId));
  const designCount = Number(used?.count ?? 0);
  if (designCount > 0) return { status: "in-use", designCount };

  try {
    await db.transaction(async (tx) => {
      // Links cascade, but the delete is explicit so this doesn't depend on
      // the FK's ON DELETE surviving a future migration.
      await tx
        .delete(templateCategoryLinks)
        .where(eq(templateCategoryLinks.templateId, templateId));
      await tx.delete(templates).where(eq(templates.id, templateId));
    });
  } catch (error) {
    // A design created between the count above and the delete: the FK is the
    // real gate, so report it the same way rather than 500ing.
    if (isRowReferencedError(error)) return { status: "in-use", designCount: 1 };
    throw error;
  }
  return { status: "deleted" };
}

/**
 * Save the authoring editor's work-in-progress layout. This deliberately
 * never touches `layout` — a published template keeps serving its current
 * pages to customers until an admin explicitly publishes the draft.
 * False when the slug is unknown.
 */
export async function adminSaveTemplateDraftLayout(
  slug: string,
  pages: DesignPage[],
): Promise<boolean> {
  const templateId = await resolveTemplateId(slug);
  if (!templateId) return false;
  // The route validates too; this guards every other caller (the generator,
  // scripts) against a layout with pages its product doesn't print.
  const template = await adminGetTemplate(slug);
  const checked = parseLayoutPages(pages, template!.productFormat.templatePages);
  if (!checked.ok) throw new Error(`Layout for "${slug}" rejected: ${checked.error}`);
  await db
    .update(templates)
    .set({ draftLayout: pages })
    .where(eq(templates.id, templateId));
  return true;
}

/**
 * Promote the draft to the live layout. "nothing" when there are no
 * unpublished changes, so the UI can say so rather than silently no-op.
 * Returns the published pages on success — the caller uses page 0 of these
 * to regenerate the preview thumbnail, without a second read.
 */
export async function adminPublishTemplateLayout(
  slug: string,
): Promise<
  | { status: "published"; pages: DesignPage[] }
  | { status: "nothing" }
  | { status: "not-found" }
> {
  const [row] = await db
    .select({ id: templates.id, draftLayout: templates.draftLayout })
    .from(templates)
    .where(eq(templates.slug, slug))
    .limit(1);
  if (!row) return { status: "not-found" };
  if (!row.draftLayout) return { status: "nothing" };
  await db
    .update(templates)
    .set({ layout: row.draftLayout, draftLayout: null })
    .where(eq(templates.id, row.id));
  return { status: "published", pages: row.draftLayout };
}

/** Throw away unpublished changes, leaving the live layout untouched. */
export async function adminDiscardTemplateDraftLayout(slug: string): Promise<boolean> {
  const templateId = await resolveTemplateId(slug);
  if (!templateId) return false;
  await db
    .update(templates)
    .set({ draftLayout: null })
    .where(eq(templates.id, templateId));
  return true;
}

/**
 * Remove the authored layout entirely — live copy and draft — reverting the
 * template to the generic makeStarterDoc() starter pages.
 */
export async function adminClearTemplateLayout(slug: string): Promise<boolean> {
  const templateId = await resolveTemplateId(slug);
  if (!templateId) return false;
  await db
    .update(templates)
    .set({ layout: null, draftLayout: null })
    .where(eq(templates.id, templateId));
  return true;
}
