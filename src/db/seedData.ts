/**
 * Pure seed-row builders — no DB import here, so this stays importable (and
 * testable) without DATABASE_URL being set. src/db/seed.ts is the thin
 * runner that resolves these rows' slug references to the surrogate ids
 * MySQL assigns on insert, then feeds them into the client.
 *
 * Every builder below returns rows keyed by `slug` (and, for anything with a
 * catalogue parent, a `*Slug` reference like `productSlug`) rather than a
 * real foreign key — a surrogate int PK doesn't exist until the row is
 * inserted, so slug-to-id resolution has to happen in seed.ts, which runs
 * against a live database.
 */
import { CATEGORY_ACCENTS } from "@/lib/designEditor";
import {
  COLOUR_OPTIONS,
  DELIVERY_OPTIONS,
  PAGE_OPTIONS,
  PAPER_OPTIONS,
  QUANTITY_OPTIONS,
  SIZE_OPTIONS,
} from "@/lib/orderOfServicePricing";
import { CATEGORIES, DEFAULT_PRODUCT, PRODUCTS, TEMPLATES } from "@/lib/templates";

const toPence = (pounds: number) => Math.round(pounds * 100);
const toMultiplier = (value: number) => value.toFixed(4);

export function buildProductsSeed() {
  return PRODUCTS.map((product, index) => ({
    slug: product.id,
    label: product.label,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildTemplateCategoriesSeed() {
  return CATEGORIES.map((category, index) => ({
    slug: category.id,
    label: category.label,
    accentHex: CATEGORY_ACCENTS[category.id] ?? "#1f1a1e",
    sortOrder: index,
    isActive: true,
  }));
}

export function buildTemplatesSeed() {
  return TEMPLATES.map((template, index) => ({
    slug: template.id,
    name: template.name,
    productSlug: template.productId,
    previewImageUrl: template.image,
    layout: null,
    status: "published" as const,
    sortOrder: index,
  }));
}

export function buildTemplateCategoryLinksSeed() {
  return TEMPLATES.flatMap((template) =>
    template.categories.map((categorySlug, position) => ({
      templateSlug: template.id,
      categorySlug,
      position,
    })),
  );
}

export function buildSizeOptionsSeed() {
  return SIZE_OPTIONS.map((option, index) => ({
    productSlug: DEFAULT_PRODUCT,
    slug: option.id,
    label: option.label,
    multiplier: toMultiplier(option.multiplier),
    note: option.note ?? null,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildColourOptionsSeed() {
  return COLOUR_OPTIONS.map((option, index) => ({
    productSlug: DEFAULT_PRODUCT,
    slug: option.id,
    label: option.label,
    multiplier: toMultiplier(option.multiplier),
    note: option.note ?? null,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildPaperOptionsSeed() {
  return PAPER_OPTIONS.map((option, index) => ({
    productSlug: DEFAULT_PRODUCT,
    slug: option.id,
    label: option.label,
    multiplier: toMultiplier(option.multiplier),
    note: option.note ?? null,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildQuantityOptionsSeed() {
  return QUANTITY_OPTIONS.map((option, index) => ({
    productSlug: DEFAULT_PRODUCT,
    slug: option.id,
    label: option.label,
    multiplier: toMultiplier(option.multiplier),
    note: option.note ?? null,
    copies: option.value,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildPageCountOptionsSeed() {
  return PAGE_OPTIONS.map((option, index) => ({
    productSlug: DEFAULT_PRODUCT,
    slug: option.id,
    label: option.label,
    pageCount: option.pages,
    baseRatePence: toPence(option.rate),
    note: option.note ?? null,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildDeliveryOptionsSeed() {
  return DELIVERY_OPTIONS.map((option, index) => ({
    productSlug: DEFAULT_PRODUCT,
    slug: option.id,
    label: option.label,
    pricePence: toPence(option.price),
    note: option.note,
    sortOrder: index,
    isActive: true,
  }));
}
