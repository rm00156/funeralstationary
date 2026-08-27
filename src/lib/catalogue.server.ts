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
import type { DesignPage } from "@/lib/designEditor";
import type {
  CategoryShowcase,
  Product,
  Template,
  TemplateCategory,
} from "@/lib/templates";

export const getProducts = cache(async (): Promise<Product[]> => {
  const rows = await db
    .select({ slug: products.slug, label: products.label })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.sortOrder), asc(products.id));
  return rows.map((row) => ({ id: row.slug, label: row.label }));
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
 * Active categories that actually have published templates, each carrying the
 * preview image of its first template — what the home page's product range
 * grid renders, so those tiles are the real catalogue rather than a parallel
 * hardcoded list. Categories with no published template are omitted: a tile
 * that leads to an empty results page is worse than no tile.
 */
export const getCategoryShowcase = cache(
  async (): Promise<CategoryShowcase[]> => {
    const rows = await db
      .select({
        slug: templateCategories.slug,
        label: templateCategories.label,
        image: templates.previewImageUrl,
      })
      .from(templateCategories)
      .innerJoin(
        templateCategoryLinks,
        eq(templateCategoryLinks.categoryId, templateCategories.id),
      )
      .innerJoin(templates, eq(templateCategoryLinks.templateId, templates.id))
      .where(
        and(
          eq(templateCategories.isActive, true),
          eq(templates.status, "published"),
        ),
      )
      .orderBy(
        asc(templateCategories.sortOrder),
        asc(templateCategories.id),
        asc(templates.sortOrder),
        asc(templates.id),
      );

    // Rows arrive category-ordered then template-ordered, so the first row of
    // each group is both the tile's image and the start of its count.
    const byCategory = new Map<string, CategoryShowcase>();
    for (const row of rows) {
      const existing = byCategory.get(row.slug);
      if (existing) {
        existing.templateCount += 1;
        continue;
      }
      byCategory.set(row.slug, {
        id: row.slug,
        label: row.label,
        image: row.image,
        templateCount: 1,
      });
    }
    return [...byCategory.values()];
  },
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

export const templateExists = cache(async (slug: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: templates.id })
    .from(templates)
    .where(eq(templates.slug, slug))
    .limit(1);
  return !!row;
});

export const productExists = cache(async (slug: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return !!row;
});
