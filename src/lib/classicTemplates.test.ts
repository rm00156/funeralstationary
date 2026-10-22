import { describe, expect, it } from "vitest";
import { CLIPARTS } from "@/components/PageCanvas";
import { parseLayoutPages } from "@/lib/adminValidation";
import {
  CLASSIC_DESIGN_IDS,
  CLASSIC_TEMPLATE_SPECS,
  SUNRISE_SUNSET,
  buildClassicLayout,
} from "@/lib/classicTemplates";
import { TEMPLATE_PAGE_COUNT, type CanvasElement, type TextElement } from "@/lib/designEditor";
import { FLAT_TEMPLATE_SPECS } from "@/lib/flatTemplates";
import { isPlaceholderPortraitId } from "@/lib/placeholderPortraits";
import { CATEGORIES } from "@/db/seedCatalogue";
import { PLACEHOLDER_INTERIOR, PLACEHOLDER_NAME, TEMPLATE_SPECS } from "@/lib/templateGenerator";

const layouts = CLASSIC_DESIGN_IDS.map((id) => ({ id, pages: buildClassicLayout(id) }));
const texts = (elements: CanvasElement[]) =>
  elements.filter((element): element is TextElement => element.type === "text");

describe("buildClassicLayout", () => {
  it("builds a cover, interior and back page the layout validator accepts", () => {
    for (const { pages } of layouts) {
      expect(pages).toHaveLength(TEMPLATE_PAGE_COUNT);
      expect(parseLayoutPages(pages).ok).toBe(true);
    }
  });

  it("gives every cover exactly one empty photo window", () => {
    for (const { id, pages } of layouts) {
      const photos = pages[0].elements.filter((element) => element.type === "image");
      expect(photos, id).toHaveLength(1);
      expect(photos[0].type === "image" && photos[0].src).toBeNull();
    }
  });

  it("flags the name and dates for the pre-order check, but not the fixed headings", () => {
    for (const { id, pages } of layouts) {
      const cover = texts(pages[0].elements);
      expect(cover.find((t) => t.text === PLACEHOLDER_NAME)?.placeholder, id).toBe(true);
      expect(cover.some((t) => t.placeholder && /1936/.test(t.text)), id).toBe(true);
      for (const heading of cover.filter((t) => /^(In Loving Memory|Service|Venue)/i.test(t.text))) {
        expect(heading.placeholder, `${id}: ${heading.text}`).toBeUndefined();
      }
    }
  });

  it("repeats a generic interior page, never the service details", () => {
    for (const { pages } of layouts) {
      const interior = texts(pages[1].elements);
      expect(interior.map((t) => t.text)).toEqual([PLACEHOLDER_INTERIOR]);
      expect(interior.some((t) => t.text === SUNRISE_SUNSET)).toBe(false);
    }
  });

  it("carries the cover's border onto the back page", () => {
    for (const { id, pages } of layouts) {
      const chrome = (elements: CanvasElement[]) =>
        elements
          .filter((element) => element.type !== "text" && element.type !== "image")
          .map((element) => element.type);
      const back = chrome(pages[2].elements);
      expect(chrome(pages[0].elements).slice(0, back.length), id).toEqual(back);
    }
  });

  it("gives every page and element a fresh id", () => {
    for (const { pages } of layouts) {
      const ids = [...pages.map((p) => p.id), ...pages.flatMap((p) => p.elements.map((e) => e.id))];
      expect(new Set(ids).size).toBe(ids.length);
    }
    const [a, b] = [buildClassicLayout("star"), buildClassicLayout("star")];
    expect(a[0].elements[0].id).not.toBe(b[0].elements[0].id);
  });

  it("keeps every text box inside the trim", () => {
    for (const { id, pages } of layouts) {
      for (const t of pages.flatMap((page) => texts(page.elements))) {
        expect(t.x, `${id}: ${t.text}`).toBeGreaterThanOrEqual(0);
        expect(t.x + t.w, `${id}: ${t.text}`).toBeLessThanOrEqual(100);
        expect(t.y, `${id}: ${t.text}`).toBeGreaterThan(0);
        expect(t.y, `${id}: ${t.text}`).toBeLessThan(95);
      }
    }
  });

  it("only uses clipart the editor can draw", () => {
    const known = new Set(CLIPARTS.map((entry) => entry.id));
    for (const { pages } of layouts) {
      for (const element of pages.flatMap((page) => page.elements)) {
        if (element.type === "clipart") expect(known.has(element.icon), element.icon).toBe(true);
      }
    }
  });

  it("sets a deep ground's interior on paper, so a running order stays readable", () => {
    const [cover, interior, back] = buildClassicLayout("classic-posh");
    expect(cover.background).toBe(back.background);
    expect(interior.background).not.toBe(cover.background);
  });
});

describe("CLASSIC_TEMPLATE_SPECS", () => {
  it("builds every design once", () => {
    expect(CLASSIC_TEMPLATE_SPECS.map((spec) => spec.design).sort()).toEqual([...CLASSIC_DESIGN_IDS].sort());
  });

  it("has slugs no other generated template uses", () => {
    const slugs = [
      ...CLASSIC_TEMPLATE_SPECS.map((spec) => spec.slug),
      ...TEMPLATE_SPECS.map((spec) => spec.slug),
      ...FLAT_TEMPLATE_SPECS.map((spec) => spec.slug),
    ];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // These were once named after their slugs ("Classic Template 2"); renaming
  // them must not move the slug, which URLs and order history carry.
  it("keeps each slug when its name changes", () => {
    const slugs = Object.fromEntries(CLASSIC_TEMPLATE_SPECS.map((spec) => [spec.name, spec.slug]));
    expect(slugs).toMatchObject({
      "Simple Celebration": "classic-template",
      "Graceful Script": "classic-template-2",
      "Pastel Blue": "classic-template-blue",
      "Pastel Peach": "classic-template-peach",
      "Vintage Frame": "border-corner-2",
    });
  });

  it("names every design for a customer, not like a file", () => {
    for (const spec of CLASSIC_TEMPLATE_SPECS) {
      expect(spec.name, spec.slug).not.toMatch(/\btemplate\b|\d/i);
    }
  });

  it("files each under categories that exist, with a real stand-in portrait", () => {
    const categories = new Set(CATEGORIES.map((category) => category.id));
    for (const spec of CLASSIC_TEMPLATE_SPECS) {
      expect(spec.categories.length, spec.slug).toBeGreaterThan(0);
      for (const category of spec.categories) expect(categories.has(category), category).toBe(true);
      expect(isPlaceholderPortraitId(spec.portrait), spec.slug).toBe(true);
    }
  });
});
