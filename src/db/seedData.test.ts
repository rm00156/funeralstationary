import { describe, expect, it } from "vitest";
import {
  COLOUR_OPTIONS,
  DELIVERY_OPTIONS,
  PAGE_OPTIONS,
  PAPER_OPTIONS,
  QUANTITY_OPTIONS,
  SIZE_OPTIONS,
} from "@/lib/orderOfServicePricing";
import { CATEGORIES, PRODUCTS, TEMPLATES } from "@/lib/templates";
import {
  buildColourOptionsSeed,
  buildDeliveryOptionsSeed,
  buildPageCountOptionsSeed,
  buildPaperOptionsSeed,
  buildProductsSeed,
  buildQuantityOptionsSeed,
  buildSizeOptionsSeed,
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
  it("builds one row per pricing option", () => {
    expect(buildSizeOptionsSeed()).toHaveLength(SIZE_OPTIONS.length);
    expect(buildColourOptionsSeed()).toHaveLength(COLOUR_OPTIONS.length);
    expect(buildPaperOptionsSeed()).toHaveLength(PAPER_OPTIONS.length);
    expect(buildQuantityOptionsSeed()).toHaveLength(QUANTITY_OPTIONS.length);
    expect(buildPageCountOptionsSeed()).toHaveLength(PAGE_OPTIONS.length);
    expect(buildDeliveryOptionsSeed()).toHaveLength(DELIVERY_OPTIONS.length);
  });

  it("carries the real copy count onto quantity option rows", () => {
    const fifty = buildQuantityOptionsSeed().find((o) => o.slug === "50");
    expect(fifty?.copies).toBe(50);
  });

  it("converts pound rates to integer pence", () => {
    const fourPage = buildPageCountOptionsSeed().find((o) => o.slug === "4");
    expect(fourPage?.baseRatePence).toBe(220);

    const nextDay = buildDeliveryOptionsSeed().find((o) => o.slug === "next-day");
    expect(nextDay?.pricePence).toBe(1000);

    const standard = buildDeliveryOptionsSeed().find((o) => o.slug === "standard");
    expect(standard?.pricePence).toBe(0);
  });

  it("keeps multiplier precision as a fixed 4dp string", () => {
    const fifty = buildQuantityOptionsSeed().find((o) => o.slug === "50");
    expect(fifty?.multiplier).toBe("0.9000");
  });
});
