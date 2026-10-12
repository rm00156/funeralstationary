/**
 * Client-facing shapes for the template catalogue.
 *
 * The rows themselves live in MySQL (products / template_categories /
 * templates) and are loaded server-side by src/lib/catalogue.server.ts, then
 * passed to client components as props — nothing imports a hardcoded
 * catalogue any more. All ids here are slugs; surrogate ids never leave
 * src/db (see src/lib/designs.server.ts).
 */

import type { ProductFormat } from "@/lib/designEditor";
import type { VatTreatment } from "@/lib/vat";

export interface Product {
  id: string;
  label: string;
  /** Its trim, template structure and axis names (products.size_label, …). */
  format: ProductFormat;
  /** How it's taxed (products.vat_treatment) — decides whether its price says "Includes VAT". */
  vatTreatment: VatTreatment;
}

/** When a product is needed — the shop's grouping (products.occasion). */
export const PRODUCT_OCCASIONS = ["service", "after"] as const;
export type ProductOccasion = (typeof PRODUCT_OCCASIONS)[number];

export const OCCASION_LABELS: Record<ProductOccasion, string> = {
  service: "For the service",
  after: "After the service",
};

export interface TemplateCategory {
  id: string;
  label: string;
}

export interface Template {
  id: string;
  name: string;
  /** Category ids this design belongs to, in position order. */
  categories: string[];
  /**
   * The single product this design's starter content is built for — its
   * layout (cover / running order / back page, via makeStarterDoc) is
   * specific to that product's format, so a template belongs to exactly one
   * product, not many.
   */
  productId: string;
  image: string;
  /**
   * Accent colour from the template's first category (template_categories.
   * accent_hex). Optional so hand-built fixtures stay valid; templateAccent()
   * falls back to the static CATEGORY_ACCENTS map when absent.
   */
  accent?: string;
}

export function filterTemplates(
  templates: Template[],
  productId: string,
  categoryId: string | null,
) {
  return templates.filter(
    (template) =>
      template.productId === productId &&
      (categoryId === null || template.categories.includes(categoryId)),
  );
}

/**
 * The designs the home page's "Choose a design to begin" grid shows: `count`
 * of them, the ones in `categoryId` first (the plain designs that suit a first
 * look, chosen by tagging them in /admin), then the rest to fill the grid, and
 * in each group a design the hero already pictures (`heroIds`) only when
 * nothing else is left. Catalogue order holds within each group.
 */
export function homeDesignPicks(
  templates: Template[],
  { categoryId, heroIds, count }: { categoryId: string; heroIds: string[]; count: number },
): Template[] {
  const rank = (template: Template) =>
    (template.categories.includes(categoryId) ? 0 : 2) + (heroIds.includes(template.id) ? 1 : 0);
  return templates
    .map((template, index) => ({ template, index, rank: rank(template) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, count)
    .map(({ template }) => template);
}

/**
 * A product the shop can actually sell — it has published templates and a
 * complete set of pricing options — as shown on the home page's product
 * cards, the header's shop menu and the product page. Products that aren't
 * ready are simply absent, so a product configured half-way in /admin never
 * appears as an empty shelf.
 */
export interface ProductShowcase extends Product {
  /** The card blurb (products.description); null when the admin hasn't written one. */
  description: string | null;
  occasion: ProductOccasion;
  /** Preview image of the product's first published template. */
  image: string;
  templateCount: number;
  /** The cheapest configuration — see cheapestQuote(). */
  fromPence: number;
  fromCopies: number;
}
