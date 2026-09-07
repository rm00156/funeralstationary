import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_PORTRAIT_IDS,
  placeholderPortraitKey,
  portraitIdForSeed,
  withPlaceholderPhotos,
} from "./placeholderPortraits";
import { TEMPLATE_SPECS, buildTemplateLayout } from "./templateGenerator";
import type { DesignPage } from "./designEditor";

const page = (elements: DesignPage["elements"]): DesignPage => ({ id: "p", elements });

describe("portraitIdForSeed", () => {
  it("is stable for a given seed", () => {
    expect(portraitIdForSeed("cabbage-rose")).toBe(portraitIdForSeed("cabbage-rose"));
  });

  it("only ever returns a known portrait", () => {
    for (const spec of TEMPLATE_SPECS) {
      expect(PLACEHOLDER_PORTRAIT_IDS).toContain(portraitIdForSeed(spec.slug));
    }
  });

  it("spreads the catalogue across all three, not one face everywhere", () => {
    const used = new Set(TEMPLATE_SPECS.map((s) => portraitIdForSeed(s.slug)));
    expect(used.size).toBe(PLACEHOLDER_PORTRAIT_IDS.length);
  });
});

describe("placeholderPortraitKey", () => {
  it("keys by id", () => {
    expect(placeholderPortraitKey("portrait-2")).toBe("templates/placeholders/portrait-2.jpg");
  });
});

describe("withPlaceholderPhotos", () => {
  it("fills empty photo windows and leaves artwork alone", () => {
    const original = page([
      { id: "a", type: "image", src: null, x: 0, y: 0, w: 10, h: 10 },
      { id: "b", type: "image", src: "/spray.png", locked: true, x: 0, y: 0, w: 10, h: 10 },
      { id: "c", type: "text", text: "x", fontFamily: "lato", fontSize: 10, align: "center", color: "#000", x: 0, y: 0, w: 10, h: 0 },
    ]);
    const filled = withPlaceholderPhotos(original, "/portrait.jpg");
    expect(filled.elements[0].type === "image" && filled.elements[0].src).toBe("/portrait.jpg");
    expect(filled.elements[1].type === "image" && filled.elements[1].src).toBe("/spray.png");
    expect(filled.elements[2].type).toBe("text");
  });

  it("never mutates the page it was given — the stored layout keeps its nulls", () => {
    const original = page([{ id: "a", type: "image", src: null, x: 0, y: 0, w: 10, h: 10 }]);
    withPlaceholderPhotos(original, "/portrait.jpg");
    expect(original.elements[0].type === "image" && original.elements[0].src).toBeNull();
  });

  it("fills the photo window on a real generated cover", () => {
    const spec = TEMPLATE_SPECS.find((s) => s.archetype === "keepsake")!;
    const [cover] = buildTemplateLayout(spec, { sprayUrl: "/spray.png" });
    const filled = withPlaceholderPhotos(cover, "/portrait.jpg");
    expect(filled.elements.some((el) => el.type === "image" && el.src === "/portrait.jpg")).toBe(true);
    expect(filled.elements.some((el) => el.type === "image" && el.src === null)).toBe(false);
  });
});
