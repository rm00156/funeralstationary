import { describe, expect, it } from "vitest";

import {
  filterProducts,
  groupByOccasion,
  reorderWithinGroup,
  statusCounts,
  suggestSlug,
  type ListedProduct,
} from "@/lib/adminProducts";
import { parseSlug } from "@/lib/adminValidation";

const product = (slug: string, extra: Partial<ListedProduct> = {}): ListedProduct => ({
  slug,
  label: slug,
  description: null,
  occasion: "service",
  isActive: true,
  ...extra,
});

// Sort order as stored: one order across both groups.
const RANGE = [
  product("booklet", { label: "Order of Service Booklets", description: "Printed at exact A5" }),
  product("thank-you", { occasion: "after", label: "Thank You Cards" }),
  product("memorial-card", { label: "Memorial Cards" }),
  product("bookmark", { label: "Bookmarks" }),
  product("pet-card", { occasion: "after", label: "Pet Sympathy Cards", isActive: false }),
];

describe("reorderWithinGroup", () => {
  it("moves a product among its own group's places and leaves the other group where it was", () => {
    expect(reorderWithinGroup(RANGE, "bookmark", 0)).toEqual([
      "bookmark",
      "thank-you",
      "booklet",
      "memorial-card",
      "pet-card",
    ]);
  });

  it("moves down as well as up", () => {
    expect(reorderWithinGroup(RANGE, "booklet", 2)).toEqual([
      "memorial-card",
      "thank-you",
      "bookmark",
      "booklet",
      "pet-card",
    ]);
  });

  it("swaps the other group without touching the first", () => {
    expect(reorderWithinGroup(RANGE, "pet-card", 0)).toEqual([
      "booklet",
      "pet-card",
      "memorial-card",
      "bookmark",
      "thank-you",
    ]);
  });

  it("clamps the target and ignores an unknown slug", () => {
    const unchanged = RANGE.map((entry) => entry.slug);
    expect(reorderWithinGroup(RANGE, "booklet", 99)).toEqual([
      "memorial-card",
      "thank-you",
      "bookmark",
      "booklet",
      "pet-card",
    ]);
    expect(reorderWithinGroup(RANGE, "booklet", -1)).toEqual(unchanged);
    expect(reorderWithinGroup(RANGE, "nope", 0)).toEqual(unchanged);
  });
});

describe("groupByOccasion", () => {
  it("lists the service group first, each in sort order, and drops an empty group", () => {
    const groups = groupByOccasion(RANGE);
    expect(groups.map((group) => group.occasion)).toEqual(["service", "after"]);
    expect(groups[0].products.map((entry) => entry.slug)).toEqual(["booklet", "memorial-card", "bookmark"]);
    expect(groupByOccasion(RANGE.filter((entry) => entry.occasion === "after")).map((g) => g.occasion)).toEqual([
      "after",
    ]);
  });
});

describe("filterProducts", () => {
  it("searches name, description and slug, every word, ignoring case", () => {
    expect(filterProducts(RANGE, "cards", "all").map((entry) => entry.slug)).toEqual([
      "thank-you",
      "memorial-card",
      "pet-card",
    ]);
    expect(filterProducts(RANGE, "exact a5", "all").map((entry) => entry.slug)).toEqual(["booklet"]);
    expect(filterProducts(RANGE, "BOOKMARK", "all").map((entry) => entry.slug)).toEqual(["bookmark"]);
    expect(filterProducts(RANGE, "  ", "all")).toHaveLength(RANGE.length);
  });

  it("narrows to active or inactive", () => {
    expect(filterProducts(RANGE, "", "inactive").map((entry) => entry.slug)).toEqual(["pet-card"]);
    expect(filterProducts(RANGE, "cards", "active").map((entry) => entry.slug)).toEqual([
      "thank-you",
      "memorial-card",
    ]);
  });

  it("counts the tabs over the whole range", () => {
    expect(statusCounts(RANGE)).toEqual({ all: 5, active: 4, inactive: 1 });
  });
});

describe("suggestSlug", () => {
  it("kebab-cases the name into a slug the API accepts", () => {
    expect(suggestSlug("Memorial Candles")).toBe("memorial-candles");
    expect(suggestSlug("  Order of Service — A4!  ")).toBe("order-of-service-a4");
    expect(suggestSlug("Hymn & Prayer Cards")).toBe("hymn-and-prayer-cards");
    expect(suggestSlug("Crème Brûlée")).toBe("creme-brulee");
    expect(suggestSlug("!!!")).toBe("");
  });

  it("stays within 64 characters without ending on a hyphen", () => {
    const slug = suggestSlug(`${"a".repeat(63)} b`);
    expect(slug).toBe("a".repeat(63));
    expect(parseSlug(suggestSlug("word ".repeat(30)))).not.toBeNull();
  });
});
