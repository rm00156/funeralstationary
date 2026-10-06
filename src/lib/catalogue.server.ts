/**
 * Server-side reads for the catalogue (products / categories / templates).
 *
 * This is the read-side counterpart of designs.server.ts's slug seam: every
 * shape returned here is slug-based (Product.id, Template.id are slugs) and
 * surrogate ids never escape. Customer-facing loaders respect is_active /
 * status = "published" and sort_order — the admin area has its own seam that
 * sees everything.
 *
 * Each loader is wrapped in React cache() so a request that needs the same
 * data in several places (page + editor props) only queries once.
 */
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  products,
  templateCategories,
  templateCategoryLinks,
  templates,
} from "@/db/schema";
import { toProductFormat, type DesignPage, type ProductFormat } from "@/lib/designEditor";
import { cheapestQuote } from "@/lib/orderOfServicePricing";
import { getPricingData } from "@/lib/pricing.server";
import type {
  Product,
  ProductShowcase,
  Template,
  TemplateCategory,
} from "@/lib/templates";

/** The products row's format columns, for toProductFormat. */
export const productFormatColumns = {
  sizeLabel: products.sizeLabel,
  trimWidthMm: products.trimWidthMm,
  trimHeightMm: products.trimHeightMm,
  templatePages: products.templatePages,
  sizedByOption: products.sizedByOption,
  paperLabel: products.paperLabel,
};

export const getProducts = cache(async (): Promise<Product[]> => {
  const rows = await db
    .select({ slug: products.slug, label: products.label, ...productFormatColumns })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.sortOrder), asc(products.id));
  return rows.map(({ slug, label, ...format }) => ({
    id: slug,
    label,
    format: toProductFormat(format),
  }));
});

/**
 * Every product's format, active or not, by slug — for showing an order's
 * lines, whose product may since have been retired (products are never
 * deleted, and a format is fixed once a template exists).
 */
export const getProductFormats = cache(async (): Promise<Map<string, ProductFormat>> => {
  const rows = await db.select({ slug: products.slug, ...productFormatColumns }).from(products);
  return new Map(rows.map(({ slug, ...format }) => [slug, toProductFormat(format)]));
});

/**
 * Every product's label, active or not, by slug — for a basket or order line
 * of the customer's own artwork, which has no design row to join it from.
 */
export const getProductLabels = cache(async (): Promise<Map<string, string>> => {
  const rows = await db.select({ slug: products.slug, label: products.label }).from(products);
  return new Map(rows.map((row) => [row.slug, row.label]));
});

export const getCategories = cache(async (): Promise<TemplateCategory[]> => {
  const rows = await db
    .select({ slug: templateCategories.slug, label: templateCategories.label })
    .from(templateCategories)
    .where(eq(templateCategories.isActive, true))
    .orderBy(asc(templateCategories.sortOrder), asc(templateCategories.id));
  return rows.map((row) => ({ id: row.slug, label: row.label }));
});

/**
 * The products the shop can sell right now: active, with at least one
 * published template and options on every pricing axis. This is what the
 * home page's product cards, the header's shop menu, the template browser's
 * product picker and the product page are built from, so a product that is
 * still being set up in /admin (no templates yet, or a pricing table left
 * empty) is simply absent rather than an empty shelf, and appears by itself
 * the moment it is complete. Each carries its first published template's
 * preview as its picture and its cheapest configuration as the "from" price.
 */
export const getSellableProducts = cache(async (): Promise<ProductShowcase[]> => {
  const rows = await db
    .select({
      slug: products.slug,
      label: products.label,
      description: products.description,
      occasion: products.occasion,
      image: templates.previewImageUrl,
      ...productFormatColumns,
    })
    .from(products)
    .innerJoin(templates, eq(templates.productId, products.id))
    .where(and(eq(products.isActive, true), eq(templates.status, "published")))
    .orderBy(
      asc(products.sortOrder),
      asc(products.id),
      asc(templates.sortOrder),
      asc(templates.id),
    );

  // Rows arrive product-ordered then template-ordered, so the first row of
  // each group is both the card's image and the start of its count.
  const byProduct = new Map<string, Omit<ProductShowcase, "id" | "fromPence" | "fromCopies">>();
  for (const { slug, label, description, occasion, image, ...format } of rows) {
    const existing = byProduct.get(slug);
    if (existing) {
      existing.templateCount += 1;
    } else {
      byProduct.set(slug, {
        label,
        description,
        occasion,
        image,
        format: toProductFormat(format),
        templateCount: 1,
      });
    }
  }

  const sellable: ProductShowcase[] = [];
  for (const [slug, entry] of byProduct) {
    // cheapestQuote is null when any axis has no active option — the product
    // can't be priced, so it can't be sold.
    const quote = cheapestQuote(await getPricingData(slug));
    if (!quote) continue;
    sellable.push({
      id: slug,
      ...entry,
      fromPence: quote.totalPence,
      fromCopies: quote.quantity.value,
    });
  }
  return sellable;
});

/** One sellable product by slug, or null — the product page's loader. */
export const getSellableProduct = cache(
  async (slug: string): Promise<ProductShowcase | null> =>
    (await getSellableProducts()).find((product) => product.id === slug) ?? null,
);

/**
 * Category links for a set of template ids, in position order (position is
 * load-bearing: the first category's accent_hex is the template's accent).
 */
async function loadCategoryLinks(): Promise<
  Map<number, { slug: string; accentHex: string }[]>
> {
  const rows = await db
    .select({
      templateId: templateCategoryLinks.templateId,
      slug: templateCategories.slug,
      accentHex: templateCategories.accentHex,
    })
    .from(templateCategoryLinks)
    .innerJoin(
      templateCategories,
      eq(templateCategoryLinks.categoryId, templateCategories.id),
    )
    .orderBy(asc(templateCategoryLinks.position));
  const byTemplate = new Map<number, { slug: string; accentHex: string }[]>();
  for (const row of rows) {
    const list = byTemplate.get(row.templateId) ?? [];
    list.push({ slug: row.slug, accentHex: row.accentHex });
    byTemplate.set(row.templateId, list);
  }
  return byTemplate;
}

function toTemplate(
  row: { id: number; slug: string; name: string; productSlug: string; image: string },
  links: Map<number, { slug: string; accentHex: string }[]>,
): Template {
  const categories = links.get(row.id) ?? [];
  return {
    id: row.slug,
    name: row.name,
    categories: categories.map((category) => category.slug),
    productId: row.productSlug,
    image: row.image,
    accent: categories[0]?.accentHex,
  };
}

/** Published templates, in sort order, with categories in position order. */
export const getTemplates = cache(async (): Promise<Template[]> => {
  const [rows, links] = await Promise.all([
    db
      .select({
        id: templates.id,
        slug: templates.slug,
        name: templates.name,
        productSlug: products.slug,
        image: templates.previewImageUrl,
      })
      .from(templates)
      .innerJoin(products, eq(templates.productId, products.id))
      .where(eq(templates.status, "published"))
      .orderBy(asc(templates.sortOrder), asc(templates.id)),
    loadCategoryLinks(),
  ]);
  return rows.map((row) => toTemplate(row, links));
});

/** One published template, including its authored layout (null = none yet). */
export const getTemplateBySlug = cache(
  async (
    slug: string,
  ): Promise<(Template & { layout: DesignPage[] | null }) | null> => {
    const [row] = await db
      .select({
        id: templates.id,
        slug: templates.slug,
        name: templates.name,
        productSlug: products.slug,
        image: templates.previewImageUrl,
        layout: templates.layout,
      })
      .from(templates)
      .innerJoin(products, eq(templates.productId, products.id))
      .where(and(eq(templates.slug, slug), eq(templates.status, "published")))
      .limit(1);
    if (!row) return null;
    const links = await loadCategoryLinks();
    return { ...toTemplate(row, links), layout: row.layout ?? null };
  },
);

/**
 * A saved design's own template, whatever its status. Archiving a template
 * hides it from the shop, not from the designs already made from it — and
 * opening such a design on some other template would re-point it on the next
 * save.
 */
export const getTemplateForDesign = cache(async (slug: string): Promise<Template | null> => {
  const [row] = await db
    .select({
      id: templates.id,
      slug: templates.slug,
      name: templates.name,
      productSlug: products.slug,
      image: templates.previewImageUrl,
    })
    .from(templates)
    .innerJoin(products, eq(templates.productId, products.id))
    .where(eq(templates.slug, slug))
    .limit(1);
  if (!row) return null;
  return toTemplate(row, await loadCategoryLinks());
});

/**
 * The product a template belongs to, whatever the template's status (a
 * design keeps saving after its template is archived), or null for an
 * unknown slug.
 */
export const templateProductSlug = cache(async (slug: string): Promise<string | null> => {
  const [row] = await db
    .select({ productSlug: products.slug })
    .from(templates)
    .innerJoin(products, eq(templates.productId, products.id))
    .where(eq(templates.slug, slug))
    .limit(1);
  return row?.productSlug ?? null;
});

