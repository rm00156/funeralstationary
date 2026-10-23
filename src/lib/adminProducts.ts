/**
 * The /admin/products list's decisions — grouping, search, the status tabs,
 * drag-to-reorder and the suggested slug. Pure and client-safe (no DB), so
 * the manager component and its tests share one copy.
 */
import { PRODUCT_OCCASIONS, type ProductOccasion } from "@/lib/templates";

export interface ListedProduct {
  slug: string;
  label: string;
  description: string | null;
  occasion: ProductOccasion;
  isActive: boolean;
}

export const PRODUCT_STATUS_FILTERS = ["all", "active", "inactive"] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatusFilter, string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
};

export function statusCounts(products: ListedProduct[]): Record<ProductStatusFilter, number> {
  const active = products.filter((product) => product.isActive).length;
  return { all: products.length, active, inactive: products.length - active };
}

/** Name, description or slug contains every word of the query, ignoring case. */
export function matchesProductSearch(product: ListedProduct, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [product.label, product.description ?? "", product.slug].join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function filterProducts<T extends ListedProduct>(
  products: T[],
  query: string,
  status: ProductStatusFilter,
): T[] {
  return products.filter(
    (product) =>
      (status === "all" || product.isActive === (status === "active")) &&
      matchesProductSearch(product, query),
  );
}

/**
 * The shop groups in their menu order, each with its products in sort
 * order (the list is already sorted). A group with nothing in it is left out.
 */
export function groupByOccasion<T extends ListedProduct>(
  products: T[],
): { occasion: ProductOccasion; products: T[] }[] {
  return PRODUCT_OCCASIONS.map((occasion) => ({
    occasion,
    products: products.filter((product) => product.occasion === occasion),
  })).filter((group) => group.products.length > 0);
}

/**
 * The whole range's new order after a product is moved to `toIndex` among
 * its own group. The list is shown grouped, but `sort_order` is one order
 * across every product (the first sellable one leads the home page), so the
 * group's products swap among the places they already hold and every other
 * product keeps its place. Returns the slugs in their new order — unchanged
 * when the slug is unknown.
 */
export function reorderWithinGroup(
  products: ListedProduct[],
  slug: string,
  toIndex: number,
): string[] {
  const order = products.map((product) => product.slug);
  const moving = products.find((product) => product.slug === slug);
  if (!moving) return order;

  const places = products.flatMap((product, index) =>
    product.occasion === moving.occasion ? [index] : [],
  );
  const group = places.map((index) => order[index]);
  const from = group.indexOf(slug);
  const to = Math.max(0, Math.min(toIndex, group.length - 1));
  group.splice(from, 1);
  group.splice(to, 0, slug);
  places.forEach((place, index) => {
    order[place] = group[index];
  });
  return order;
}

const MAX_SLUG_LENGTH = 64;

/** The slug suggested for a new product or option from its name: kebab case, at most 64 characters. */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}
