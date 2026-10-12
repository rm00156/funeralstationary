import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLIPARTS } from "@/components/PageCanvas";
import { parseLayoutPages } from "@/lib/adminValidation";
import { CLASSIC_TEMPLATE_SPECS } from "@/lib/classicTemplates";
import { TEMPLATE_PAGE_COUNT, type CanvasElement, type TextElement } from "@/lib/designEditor";
import { FLAT_TEMPLATE_SPECS } from "@/lib/flatTemplates";
import { isPlaceholderPortraitId } from "@/lib/placeholderPortraits";
import { CATEGORIES } from "@/db/seedCatalogue";
import { PLACEHOLDER_INTERIOR, PLACEHOLDER_NAME, TEMPLATE_SPECS } from "@/lib/templateGenerator";
import {
  ARTWORK_PATH,
  THEMED_DESIGN_IDS,
  THEMED_TEMPLATE_SPECS,
  buildThemedLayout,
  type ArtworkUrls,
} from "@/lib/themedTemplates";

const urls: ArtworkUrls = {
  background: (id, palette) => `https://bucket.test/templates/backgrounds/${id}-${palette}.jpg`,
  spray: (id) => `https://bucket.test/templates/sprays/${id}.png`,
};

const layouts = THEMED_DESIGN_IDS.map((id) => ({ id, pages: buildThemedLayout(id, urls) }));
const texts = (elements: CanvasElement[]) =>
  elements.filter((element): element is TextElement => element.type === "text");
const images = (elements: CanvasElement[]) => elements.filter((element) => element.type === "image");

describe("buildThemedLayout", () => {
  it("builds a cover, interior and back page the layout validator accepts", () => {
    for (const { pages } of layouts) {
      expect(pages).toHaveLength(TEMPLATE_PAGE_COUNT);
      expect(parseLayoutPages(pages).ok).toBe(true);
    }
  });

  it("gives every cover exactly one empty photo window for the family's photograph", () => {
    for (const { id, pages } of layouts) {
      const empty = images(pages[0].elements).filter((image) => image.type === "image" && image.src === null);
      expect(empty, id).toHaveLength(1);
    }
  });

  it("locks every piece of artwork, so a customer can't drag the flag off the page", () => {
    for (const { id, pages } of layouts) {
      for (const image of images(pages.flatMap((page) => page.elements))) {
        if (image.type === "image" && image.src !== null) expect(image.locked, `${id}: ${image.src}`).toBe(true);
      }
    }
  });

  it("only points at artwork that ships with the code or the rendered backgrounds", () => {
    for (const { id, pages } of layouts) {
      for (const image of images(pages.flatMap((page) => page.elements))) {
        if (image.type !== "image" || image.src === null) continue;
        if (image.src.startsWith(ARTWORK_PATH)) {
          expect(existsSync(path.join("public", image.src)), `${id}: ${image.src}`).toBe(true);
        } else {
          expect(image.src.startsWith("https://bucket.test/templates/"), `${id}: ${image.src}`).toBe(true);
        }
      }
    }
  });

  it("flags the name for the pre-order check, and repeats a generic interior", () => {
    for (const { id, pages } of layouts) {
      expect(texts(pages[0].elements).find((t) => t.text === PLACEHOLDER_NAME)?.placeholder, id).toBe(true);
      expect(texts(pages[1].elements).map((t) => t.text), id).toEqual([PLACEHOLDER_INTERIOR]);
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

  it("keeps every text box across the trim, not off it", () => {
    for (const { id, pages } of layouts) {
      for (const t of pages.flatMap((page) => texts(page.elements))) {
        expect(t.x, `${id}: ${t.text}`).toBeGreaterThanOrEqual(0);
        expect(t.x + t.w, `${id}: ${t.text}`).toBeLessThanOrEqual(100);
        expect(t.y, `${id}: ${t.text}`).toBeGreaterThan(0);
        expect(t.y, `${id}: ${t.text}`).toBeLessThan(95);
      }
    }
  });

  it("moves the farewell clear of the Guyana flag's arrowhead", () => {
    const back = texts(buildThemedLayout("guyana-thanksgiving", urls)[2].elements);
    expect(back[0].y).toBeGreaterThan(60);
  });
});

describe("THEMED_TEMPLATE_SPECS", () => {
  it("builds every design once", () => {
    expect(THEMED_TEMPLATE_SPECS.map((spec) => spec.design).sort()).toEqual([...THEMED_DESIGN_IDS].sort());
  });

  it("has slugs no other generated template uses", () => {
    const slugs = [
      ...THEMED_TEMPLATE_SPECS.map((spec) => spec.slug),
      ...CLASSIC_TEMPLATE_SPECS.map((spec) => spec.slug),
      ...TEMPLATE_SPECS.map((spec) => spec.slug),
      ...FLAT_TEMPLATE_SPECS.map((spec) => spec.slug),
    ];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("files each under categories that exist, with a real stand-in portrait", () => {
    const categories = new Set(CATEGORIES.map((category) => category.id));
    for (const spec of THEMED_TEMPLATE_SPECS) {
      expect(spec.categories.length, spec.slug).toBeGreaterThan(0);
      for (const category of spec.categories) expect(categories.has(category), category).toBe(true);
      expect(isPlaceholderPortraitId(spec.portrait), spec.slug).toBe(true);
    }
  });
});
