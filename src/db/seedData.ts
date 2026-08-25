/**
 * Pure seed-row builders — no DB import here, so this stays importable (and
 * testable) without DATABASE_URL being set. src/db/seed.ts is the thin
 * runner that feeds these rows into the client.
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
    id: product.id,
    label: product.label,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildTemplateCategoriesSeed() {
  return CATEGORIES.map((category, index) => ({
    id: category.id,
    label: category.label,
    accentHex: CATEGORY_ACCENTS[category.id] ?? "#1f1a1e",
    sortOrder: index,
    isActive: true,
  }));
}

export function buildTemplatesSeed() {
  return TEMPLATES.map((template, index) => ({
    id: template.id,
    name: template.name,
    previewImageUrl: template.image,
    layout: null,
    status: "published" as const,
    sortOrder: index,
  }));
}

export function buildTemplateCategoryLinksSeed() {
  return TEMPLATES.flatMap((template) =>
    template.categories.map((categoryId, position) => ({
      templateId: template.id,
      categoryId,
      position,
    })),
  );
}

export function buildTemplateProductLinksSeed() {
  return TEMPLATES.flatMap((template) =>
    template.products.map((productId) => ({
      templateId: template.id,
      productId,
    })),
  );
}

export function buildSizeOptionsSeed() {
  return SIZE_OPTIONS.map((option, index) => ({
    productId: DEFAULT_PRODUCT,
    id: option.id,
    label: option.label,
    multiplier: toMultiplier(option.multiplier),
    note: option.note ?? null,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildColourOptionsSeed() {
  return COLOUR_OPTIONS.map((option, index) => ({
    productId: DEFAULT_PRODUCT,
    id: option.id,
    label: option.label,
    multiplier: toMultiplier(option.multiplier),
    note: option.note ?? null,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildPaperOptionsSeed() {
  return PAPER_OPTIONS.map((option, index) => ({
    productId: DEFAULT_PRODUCT,
    id: option.id,
    label: option.label,
    multiplier: toMultiplier(option.multiplier),
    note: option.note ?? null,
    sortOrder: index,
    isActive: true,
  }));
}

export function buildQuantityOptionsSeed() {
  return QUANTITY_OPTIONS.map((option, index) => ({
    productId: DEFAULT_PRODUCT,
    id: option.id,
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
    productId: DEFAULT_PRODUCT,
    id: option.id,
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
    productId: DEFAULT_PRODUCT,
    id: option.id,
    label: option.label,
    pricePence: toPence(option.price),
    note: option.note,
    sortOrder: index,
    isActive: true,
  }));
}
