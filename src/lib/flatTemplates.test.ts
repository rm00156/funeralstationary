import { describe, expect, it } from "vitest";

import { PRODUCTS, TEMPLATES } from "@/db/seedCatalogue";
import { parseLayoutPages } from "@/lib/adminValidation";
import { fullBleedBox, pageMetrics, type CanvasElement, type PageTrim } from "@/lib/designEditor";
import { checkDesignReadiness } from "@/lib/designReadiness";
import {
  FLAT_TEMPLATE_PAGES,
  FLAT_TEMPLATE_SPECS,
  buildFlatTemplateLayout,
  flatArchetypeFits,
  flatBackgroundFormat,
  flatSpecNeedsBackground,
  flatSpecNeedsSpray,
  type FlatTemplateSpec,
} from "@/lib/flatTemplates";
import { backgroundLayout, getBackgroundSpec } from "@/lib/backgroundArtwork";
import { TEMPLATE_SPECS } from "@/lib/templateGenerator";

/** The trim each flat product is seeded with — what the runner reads from the DB. */
function trimFor(product: string): PageTrim {
  const format = PRODUCTS.find((entry) => entry.id === product)?.format;
  if (!format) throw new Error(`No seeded format for ${product}`);
  return { widthMm: format.trimWidthMm, heightMm: format.trimHeightMm };
}

const BACKGROUND_URL = "https://example.test/background.jpg";

const build = (spec: FlatTemplateSpec) =>
  buildFlatTemplateLayout(spec, trimFor(spec.product), {
    sprayUrl: flatSpecNeedsSpray(spec) ? "https://example.test/spray.png" : undefined,
    backgroundUrl: flatSpecNeedsBackground(spec) ? BACKGROUND_URL : undefined,
  });

type Text = Extract<CanvasElement, { type: "text" }>;
const texts = (elements: CanvasElement[]) => elements.filter((element): element is Text => element.type === "text");

describe("flat template specs", () => {
  it("covers every flat product", () => {
    for (const product of Object.keys(FLAT_TEMPLATE_PAGES)) {
      expect(FLAT_TEMPLATE_SPECS.some((spec) => spec.product === product)).toBe(true);
    }
  });

  it("uses slugs no other template uses", () => {
    const slugs = [
      ...FLAT_TEMPLATE_SPECS.map((spec) => spec.slug),
      ...TEMPLATE_SPECS.map((spec) => spec.slug),
      ...TEMPLATES.map((template) => template.id),
    ];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("names a spray exactly when the archetype needs one", () => {
    for (const spec of FLAT_TEMPLATE_SPECS) {
      expect(!!spec.spray).toBe(flatSpecNeedsSpray(spec));
    }
  });

  it("pairs every archetype with a product it suits", () => {
    for (const spec of FLAT_TEMPLATE_SPECS) expect(flatArchetypeFits(spec)).toBe(true);
    expect(flatArchetypeFits({ archetype: "bookmark-photo", product: "memory-board" })).toBe(false);
    expect(flatArchetypeFits({ archetype: "framed", product: "bookmarks" })).toBe(false);
  });

  it("names a background exactly when the archetype needs one, rendered for its palette and format", () => {
    for (const spec of FLAT_TEMPLATE_SPECS) {
      expect(!!spec.background, spec.slug).toBe(flatSpecNeedsBackground(spec));
      if (!spec.background) continue;
      const background = getBackgroundSpec(spec.background);
      expect(background, spec.slug).toBeDefined();
      expect(background!.palettes, spec.slug).toContain(spec.palette);
      if (flatBackgroundFormat(spec) === "bookmark") expect(background!.bookmark, spec.slug).toBeDefined();
    }
  });

  it("names a cutout that exists for every spray archetype", () => {
    for (const spec of FLAT_TEMPLATE_SPECS.filter((entry) => entry.spray)) {
      expect(getBackgroundSpec(spec.spray!)?.spray, spec.slug).toBeDefined();
    }
  });

  it("pairs every memorial card in the set with a bookmark of the same name", () => {
    const own = FLAT_TEMPLATE_SPECS.filter((spec) => spec.archetype.startsWith("card-"));
    expect(own.length).toBeGreaterThan(0);
    for (const card of own) {
      const bookmark = FLAT_TEMPLATE_SPECS.find(
        (spec) => spec.product === "bookmarks" && spec.name === card.name,
      );
      expect(bookmark, card.slug).toBeDefined();
      expect(bookmark!.spray ?? bookmark!.background, card.slug).toBe(card.spray ?? card.background);
    }
  });

  it("agrees with the seeded formats on page counts", () => {
    for (const [product, pages] of Object.entries(FLAT_TEMPLATE_PAGES)) {
      expect(PRODUCTS.find((entry) => entry.id === product)?.format?.templatePages).toBe(pages);
    }
  });
});

describe("buildFlatTemplateLayout", () => {
  it.each(FLAT_TEMPLATE_SPECS.map((spec) => [spec.slug, spec] as const))(
    "%s builds a layout its product accepts",
    (_slug, spec) => {
      const pages = build(spec);
      const parsed = parseLayoutPages(pages, FLAT_TEMPLATE_PAGES[spec.product]);
      expect(parsed.ok).toBe(true);
    },
  );

  it("gives every design a photo window and a name to replace", () => {
    for (const spec of FLAT_TEMPLATE_SPECS) {
      const pages = build(spec);
      const elements = pages.flatMap((page) => page.elements);
      // Thank-you cards needn't carry a photo; everything else is photo-led.
      if (spec.product !== "thank-you-cards") {
        expect(elements.some((element) => element.type === "image" && element.src === null)).toBe(true);
      }
      expect(elements.some((element) => element.type === "text" && element.placeholder)).toBe(true);
    }
  });

  it("leaves the booklet's service details off cards and boards", () => {
    for (const spec of FLAT_TEMPLATE_SPECS) {
      const texts = build(spec)
        .flatMap((page) => page.elements)
        .filter((element): element is Extract<CanvasElement, { type: "text" }> => element.type === "text");
      expect(texts.some((element) => element.text.includes("Crematorium"))).toBe(false);
    }
  });

  it("scales a borrowed cover's type to the trim", () => {
    const spec = FLAT_TEMPLATE_SPECS.find(
      (entry) => entry.product === "memorial-cards" && entry.archetype === "framed",
    )!;
    const board = { ...spec, product: "memory-board" as const };
    const fontSizes = (pages: ReturnType<typeof build>) =>
      pages[0].elements.flatMap((element) => (element.type === "text" ? [element.fontSize] : []));
    const card = fontSizes(build(spec));
    const a4 = fontSizes(build(board));
    // A6 is ~0.71 of A5 wide and A4 ~1.42, so the board's type is twice the card's.
    a4.forEach((size, index) => expect(size / card[index]).toBeCloseTo(2, 0));
  });

  it("keeps a bookmark's round portrait round", () => {
    const spec = FLAT_TEMPLATE_SPECS.find((entry) => entry.archetype === "bookmark-photo")!;
    const trim = trimFor("bookmarks");
    const { pageW, pageH } = pageMetrics(trim);
    const window = build(spec)[0].elements.find((element) => element.type === "image")!;
    expect((window.w / 100) * pageW).toBeCloseTo((window.h / 100) * pageH, 5);
  });

  it("sets a scene's background first, at the product's own bleed, under white type", () => {
    for (const spec of FLAT_TEMPLATE_SPECS.filter((entry) => entry.archetype.endsWith("-scene"))) {
      const trim = trimFor(spec.product);
      const [front] = build(spec);
      const [background] = front.elements;
      expect(background.type === "image" && background.src, spec.slug).toBe(BACKGROUND_URL);
      expect(background.locked, spec.slug).toBe(true);
      expect({ x: background.x, y: background.y, w: background.w, h: background.h }, spec.slug).toEqual(
        fullBleedBox(trim),
      );
      for (const element of texts(front.elements)) expect(element.color, element.text).toBe("#ffffff");
    }
  });

  it("keeps every band design's type above its flowers", () => {
    for (const spec of FLAT_TEMPLATE_SPECS.filter((entry) => entry.archetype.endsWith("-band"))) {
      const background = getBackgroundSpec(spec.background!)!;
      const layout = backgroundLayout(background, flatBackgroundFormat(spec));
      // Above the band's box and above where its fade leaves solid paper.
      const clear = Math.max(layout.placement!.y, layout.fade?.end ?? 0);
      for (const element of texts(build(spec)[0].elements)) {
        expect(element.y, `${spec.slug}: ${element.text}`).toBeLessThan(clear - 1);
      }
    }
  });

  it("keeps every round portrait round on its own trim", () => {
    for (const spec of FLAT_TEMPLATE_SPECS) {
      const { pageW, pageH } = pageMetrics(trimFor(spec.product));
      for (const element of build(spec)[0].elements) {
        if (element.type !== "image" || element.src !== null || element.shape !== "oval") continue;
        // Booklet covers' ovals are deliberately oval; the set's portraits are rings.
        if (!/^(card|bookmark)-(scene|band|stem|corner|flutter|bloom)$/.test(spec.archetype)) continue;
        // Within 1%: a card front is drawn in A5 units, and A6 is very nearly, not exactly, A5's shape.
        const ratio = ((element.w / 100) * pageW) / ((element.h / 100) * pageH);
        expect(Math.abs(ratio - 1), spec.slug).toBeLessThan(0.01);
      }
    }
  });

  it("refuses a scene or band without its rendered background", () => {
    const spec = FLAT_TEMPLATE_SPECS.find((entry) => entry.archetype === "bookmark-band")!;
    expect(() => buildFlatTemplateLayout(spec, trimFor("bookmarks"))).toThrow(/backgroundUrl/);
    expect(() =>
      buildFlatTemplateLayout({ ...spec, background: "redoute-frankfort-rose", palette: "plum" }, trimFor("bookmarks"), {
        backgroundUrl: BACKGROUND_URL,
      }),
    ).toThrow(/bookmark render/);
  });

  it("refuses a spray archetype without its cutout", () => {
    const spec = FLAT_TEMPLATE_SPECS.find((entry) => entry.archetype === "bookmark-spray")!;
    expect(() => buildFlatTemplateLayout(spec, trimFor("bookmarks"))).toThrow(/spray/);
  });

  it("blocks ordering until the photos are filled, like any template", () => {
    const spec = FLAT_TEMPLATE_SPECS.find((entry) => entry.archetype === "board-collage")!;
    const layout = build(spec);
    const readiness = checkDesignReadiness({ templateId: spec.slug, pages: layout }, layout);
    expect(readiness.blocking.length).toBeGreaterThan(0);
  });
});
