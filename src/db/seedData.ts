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
import { BOOKLET_FORMAT, CATEGORY_ACCENTS } from "@/lib/designEditor";
import { CATEGORIES, PRICING, PRODUCTS, TEMPLATES } from "./seedCatalogue";

const toPence = (pounds: number) => Math.round(pounds * 100);
const toMultiplier = (value: number) => value.toFixed(4);

/** The products table's defaults — the A5 booklet. */
const BOOKLET_FORMAT_ROW = {
  sizeLabel: BOOKLET_FORMAT.sizeLabel,
  trimWidthMm: BOOKLET_FORMAT.trim.widthMm,
  trimHeightMm: BOOKLET_FORMAT.trim.heightMm,
  templatePages: BOOKLET_FORMAT.templatePages,
  sizedByOption: BOOKLET_FORMAT.sizedByOption,
  paperLabel: BOOKLET_FORMAT.paperLabel,
};

export function buildProductsSeed() {
  return PRODUCTS.map((product, index) => ({
    slug: product.id,
    label: product.label,
    description: product.description,
    occasion: product.occasion,
    ...(product.format ?? BOOKLET_FORMAT_ROW),
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

// Each product's options keep their list order as sort_order.

export function buildPaperOptionsSeed() {
  return Object.entries(PRICING).flatMap(([productSlug, { paper }]) =>
    paper.map((option, index) => ({
      productSlug,
      slug: option.id,
      label: option.label,
      multiplier: toMultiplier(option.multiplier),
      note: option.note ?? null,
      sortOrder: index,
      isActive: true,
    })),
  );
}

export function buildQuantityOptionsSeed() {
  return Object.entries(PRICING).flatMap(([productSlug, { quantity }]) =>
    quantity.map((option, index) => ({
      productSlug,
      slug: option.id,
      label: option.label,
      multiplier: toMultiplier(option.multiplier),
      note: option.note ?? null,
      copies: option.value,
      sortOrder: index,
      isActive: true,
    })),
  );
}

export function buildPageCountOptionsSeed() {
  return Object.entries(PRICING).flatMap(([productSlug, { pages }]) =>
    pages.map((option, index) => ({
      productSlug,
      slug: option.id,
      label: option.label,
      pageCount: option.pages,
      baseRatePence: toPence(option.rate),
      note: option.note ?? null,
      sortOrder: index,
      isActive: true,
    })),
  );
}

export function buildDeliveryOptionsSeed() {
  return Object.entries(PRICING).flatMap(([productSlug, { delivery }]) =>
    delivery.map((option, index) => ({
      productSlug,
      slug: option.id,
      label: option.label,
      pricePence: toPence(option.price),
      note: option.note,
      sortOrder: index,
      isActive: true,
    })),
  );
}
