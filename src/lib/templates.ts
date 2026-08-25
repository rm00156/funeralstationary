/**
 * Client-facing shapes for the template catalogue.
 *
 * The rows themselves live in MySQL (products / template_categories /
 * templates) and are loaded server-side by src/lib/catalogue.server.ts, then
 * passed to client components as props — nothing imports a hardcoded
 * catalogue any more. All ids here are slugs; surrogate ids never leave
 * src/db (see src/lib/designs.server.ts).
 */

export interface Product {
  id: string;
  label: string;
}

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
