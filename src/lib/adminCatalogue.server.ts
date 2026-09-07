/**
 * Server-side admin reads/writes for the catalogue and pricing tables.
 *
 * The admin counterpart of catalogue.server.ts / pricing.server.ts: same
 * slug-only discipline (surrogate ids never escape), but nothing is filtered
 * by is_active/status — the admin sees and edits everything. Slugs are
 * immutable after create (they're snapshot keys in order history), so no
 * update below ever touches a slug column.
 *
 * There are deliberately no hard deletes: designs FK into every one of these
 * tables with ON DELETE RESTRICT, so rows are retired with is_active = false
 * (or status = "archived" for templates) instead.
 */
import { asc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  colourOptions,
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
import type { TemplateStatus } from "@/lib/adminValidation";
import type { DesignPage } from "@/lib/designEditor";

// Re-exported for the admin routes; the helper itself lives in src/db/errors.ts
// so the orders seam can share it without importing the admin module.
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
  sortOrder: number;
  isActive: boolean;
}

const productSelection = {
  slug: products.slug,
  label: products.label,
  sortOrder: products.sortOrder,
  isActive: products.isActive,
};

export async function adminListProducts(): Promise<AdminProduct[]> {
  return db
    .select(productSelection)
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.id));
}

export async function adminGetProduct(slug: string): Promise<AdminProduct | null> {
  const [row] = await db
    .select(productSelection)
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function adminCreateProduct(input: {
  slug: string;
  label: string;
  sortOrder: number;
}): Promise<AdminProduct> {
  await db.insert(products).values(input);
  return (await adminGetProduct(input.slug))!;
}

export async function adminUpdateProduct(
  slug: string,
  patch: { label?: string; sortOrder?: number; isActive?: boolean },
): Promise<AdminProduct | null> {
  const existing = await adminGetProduct(slug);
  if (!existing) return null;
  await db.update(products).set(patch).where(eq(products.slug, slug));
  return adminGetProduct(slug);
}

/* ------------------------------------------------------------------ */
/* Pricing options                                                     */
/* ------------------------------------------------------------------ */

export const OPTION_KINDS = [
  "size",
  "colour",
  "paper",
  "quantity",
  "page-count",
  "delivery",
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
}

/** Create payload — the route validates and narrows before calling in. */
export interface AdminOptionInput {
  slug: string;
  label: string;
  note: string | null;
  sortOrder: number;
  /** decimal(6,4) string, e.g. "0.9000" — size/colour/paper/quantity only. */
  multiplier?: string;
  copies?: number;
  pageCount?: number;
  baseRatePence?: number;
  pricePence?: number;
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
}>;

type MultiplierTable = typeof sizeOptions | typeof colourOptions | typeof paperOptions;

const MULTIPLIER_TABLES: Record<"size" | "colour" | "paper", MultiplierTable> = {
  size: sizeOptions,
  colour: colourOptions,
  paper: paperOptions,
};

export async function adminListOptions(
  productSlug: string,
  kind: OptionKind,
): Promise<AdminOption[] | null> {
  const productId = await resolveProductId(productSlug);
  if (!productId) return null;

  if (kind === "size" || kind === "colour" || kind === "paper") {
    const table = MULTIPLIER_TABLES[kind];
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
  if (kind === "size" || kind === "colour" || kind === "paper") {
    await db
      .insert(MULTIPLIER_TABLES[kind])
      .values({ ...base, multiplier: input.multiplier! });
  } else if (kind === "quantity") {
    await db
      .insert(quantityOptions)
      .values({ ...base, multiplier: input.multiplier!, copies: input.copies! });
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

  if (kind === "size" || kind === "colour" || kind === "paper") {
    const table = MULTIPLIER_TABLES[kind];
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
  previewImageUrl: string;
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
  previewImageUrl: templates.previewImageUrl,
  status: templates.status,
  sortOrder: templates.sortOrder,
  // Tested in SQL rather than selected: a listing only needs to know whether
  // there are unpublished changes, not haul every template's layout blob.
  hasDraftLayout: sql<number>`(${templates.draftLayout} is not null)`,
  updatedAt: templates.updatedAt,
};

export async function adminListTemplates(): Promise<AdminTemplate[]> {
  const [rows, categoriesByTemplate] = await Promise.all([
    db
      .select(templateSelection)
      .from(templates)
      .innerJoin(products, eq(templates.productId, products.id))
      .orderBy(asc(templates.sortOrder), asc(templates.id)),
    loadTemplateCategories(),
  ]);
  return rows.map(({ id, hasDraftLayout, ...row }) => ({
    ...row,
    hasDraftLayout: !!hasDraftLayout,
    categories: categoriesByTemplate.get(id) ?? [],
  }));
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
  const { id, hasDraftLayout, ...rest } = row;
  return {
    ...rest,
    hasDraftLayout: !!hasDraftLayout,
    categories: categoriesByTemplate.get(id) ?? [],
    layout: row.layout ?? null,
    draftLayout: row.draftLayout ?? null,
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

export async function adminUpdateTemplate(
  slug: string,
  patch: {
    name?: string;
    productSlug?: string;
    previewImageUrl?: string;
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
    productId = resolved;
  }

  const set = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(productId !== undefined ? { productId } : {}),
    ...(patch.previewImageUrl !== undefined
      ? { previewImageUrl: patch.previewImageUrl }
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
