import { describe, expect, it } from "vitest";
import { CATEGORIES, PRICING, PRODUCTS, TEMPLATES } from "./seedCatalogue";
import { parseLayoutPages, parsePageCount } from "@/lib/adminValidation";
import { toProductFormat } from "@/lib/designEditor";
import {
  buildDeliveryOptionsSeed,
  buildPageCountOptionsSeed,
  buildPaperOptionsSeed,
  buildProductsSeed,
  buildQuantityOptionsSeed,
  buildTemplateCategoriesSeed,
  buildTemplateCategoryLinksSeed,
  buildTemplatesSeed,
} from "./seedData";

describe("catalogue seed coverage", () => {
  it("builds one row per product, category and template", () => {
    expect(buildProductsSeed()).toHaveLength(PRODUCTS.length);
    expect(buildTemplateCategoriesSeed()).toHaveLength(CATEGORIES.length);
    expect(buildTemplatesSeed()).toHaveLength(TEMPLATES.length);
  });

  it("gives every category an accent colour", () => {
    for (const row of buildTemplateCategoriesSeed()) {
      expect(row.accentHex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("resolves every category slug referenced by a template to a real category row", () => {
    const categorySlugs = new Set(buildTemplateCategoriesSeed().map((c) => c.slug));
    for (const link of buildTemplateCategoryLinksSeed()) {
      expect(categorySlugs.has(link.categorySlug)).toBe(true);
    }
  });

  it("resolves every template's product to a real product row", () => {
    const productSlugs = new Set(buildProductsSeed().map((p) => p.slug));
    for (const template of buildTemplatesSeed()) {
      expect(productSlugs.has(template.productSlug)).toBe(true);
    }
  });

  it("preserves Template.categories array order as link position", () => {
    const gentleFarewell = TEMPLATES.find((t) => t.id === "gentle-farewell");
    if (!gentleFarewell) throw new Error("fixture template missing");
    const links = buildTemplateCategoryLinksSeed()
      .filter((l) => l.templateSlug === "gentle-farewell")
      .sort((a, b) => a.position - b.position);
    expect(links.map((l) => l.categorySlug)).toEqual(gentleFarewell.categories);
  });
});

describe("pricing seed coverage", () => {
  const total = (axis: "paper" | "quantity" | "pages" | "delivery") =>
    Object.values(PRICING).reduce((sum, tables) => sum + tables[axis].length, 0);
  const oos = <T extends { productSlug: string }>(rows: T[]) =>
    rows.filter((row) => row.productSlug === "order-of-service");

  it("builds one row per pricing option, across every product", () => {
    expect(buildPaperOptionsSeed()).toHaveLength(total("paper"));
    expect(buildQuantityOptionsSeed()).toHaveLength(total("quantity"));
    expect(buildPageCountOptionsSeed()).toHaveLength(total("pages"));
    expect(buildDeliveryOptionsSeed()).toHaveLength(total("delivery"));
  });

  it("only prices products that exist", () => {
    const productSlugs = new Set(PRODUCTS.map((product) => product.id));
    for (const slug of Object.keys(PRICING)) expect(productSlugs.has(slug)).toBe(true);
  });

  it("never reuses an option slug within one product", () => {
    for (const rows of [
      buildPaperOptionsSeed(),
      buildQuantityOptionsSeed(),
      buildPageCountOptionsSeed(),
      buildDeliveryOptionsSeed(),
    ]) {
      const keys = rows.map((row) => `${row.productSlug}/${row.slug}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("carries the real copy count onto quantity option rows", () => {
    const fifty = oos(buildQuantityOptionsSeed()).find((o) => o.slug === "50");
    expect(fifty?.copies).toBe(50);
  });

  it("converts pound rates to integer pence", () => {
    const fourPage = oos(buildPageCountOptionsSeed()).find((o) => o.slug === "4");
    expect(fourPage?.baseRatePence).toBe(220);

    const nextDay = oos(buildDeliveryOptionsSeed()).find((o) => o.slug === "next-day");
    expect(nextDay?.pricePence).toBe(1000);

    const standard = oos(buildDeliveryOptionsSeed()).find((o) => o.slug === "standard");
    expect(standard?.pricePence).toBe(0);
  });

  it("keeps multiplier precision as a fixed 4dp string", () => {
    const fifty = oos(buildQuantityOptionsSeed()).find((o) => o.slug === "50");
    expect(fifty?.multiplier).toBe("0.9000");
  });
});

describe("product formats", () => {
  const products = buildProductsSeed();
  const pageCounts = buildPageCountOptionsSeed();

  it("gives the booklet the A5 defaults", () => {
    const booklet = products.find((product) => product.slug === "order-of-service");
    expect(booklet).toMatchObject({ trimWidthMm: 148, trimHeightMm: 210, templatePages: 3 });
  });

  it("only offers page counts a product's templates can fill", () => {
    // A flat product's template has a front (and a back): a page-count option
    // beyond that would blank-fill, so the seed must never offer one.
    for (const product of products) {
      const format = toProductFormat(product);
      for (const option of pageCounts.filter((row) => row.productSlug === product.slug)) {
        expect(parsePageCount(option.pageCount)).toBe(option.pageCount);
        if (format.templatePages < 3) {
          expect(option.pageCount).toBeLessThanOrEqual(format.templatePages);
        }
      }
    }
  });

  it("sizes a board by option only across one shape", () => {
    // Every size of a sized-by-option product prints the same one-page design.
    for (const product of products.filter((row) => row.sizedByOption)) {
      expect(product.templatePages).toBe(1);
      const sizes = pageCounts.filter((row) => row.productSlug === product.slug);
      expect(sizes.length).toBeGreaterThan(1);
      for (const size of sizes) expect(size.pageCount).toBe(1);
    }
  });

  it("accepts each format's own template page count as a layout", () => {
    for (const product of products) {
      const pages = Array.from({ length: product.templatePages }, (_, index) => ({
        id: `p${index}`,
        elements: [],
      }));
      expect(parseLayoutPages(pages, toProductFormat(product).templatePages).ok).toBe(true);
    }
  });
});
