import { describe, expect, it } from "vitest";
import {
  COLOUR_PORTRAIT_IDS,
  MONO_PORTRAIT_IDS,
  ELDER_PORTRAIT_GENDER,
  ELDER_PORTRAIT_IDS,
  STUDIO_PORTRAIT_GENDER,
  STUDIO_PORTRAIT_IDS,
  PLACEHOLDER_CROP,
  PLACEHOLDER_PORTRAIT_IDS,
  placeholderPortraitKey,
  portraitIdForSeed,
  portraitRotationFor,
  portraitSetForPage,
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

  it("spreads the catalogue across each set, not one face everywhere", () => {
    for (const set of [MONO_PORTRAIT_IDS, COLOUR_PORTRAIT_IDS]) {
      const used = new Set(TEMPLATE_SPECS.map((s) => portraitIdForSeed(s.slug, set)));
      expect(used.size).toBe(set.length);
    }
  });
});

describe("placeholderPortraitKey", () => {
  it("keys by id", () => {
    expect(placeholderPortraitKey("portrait-10")).toBe("templates/placeholders/portrait-10.webp");
  });

  it("gives the reframed automatic sets their own -v2 files", () => {
    for (const id of [...MONO_PORTRAIT_IDS, ...COLOUR_PORTRAIT_IDS].filter((id) => id !== "portrait-3")) {
      expect(placeholderPortraitKey(id)).toBe(`templates/placeholders/${id}-v2.webp`);
    }
    // portrait-3 already had room above the head, so it was never redrawn.
    for (const id of ["portrait-3", ...STUDIO_PORTRAIT_IDS, ...ELDER_PORTRAIT_IDS] as const) {
      expect(placeholderPortraitKey(id)).toBe(`templates/placeholders/${id}.webp`);
    }
  });
});

const photo = (src: string | null) =>
  ({ id: `w${Math.random()}`, type: "image", src, x: 0, y: 0, w: 10, h: 10 }) as const;

describe("portraitSetForPage", () => {
  it("puts black-and-white on a plain paper cover", () => {
    expect(portraitSetForPage(page([photo(null)]))).toBe(MONO_PORTRAIT_IDS);
  });

  it("puts colour on a cover that carries artwork", () => {
    expect(portraitSetForPage(page([photo("/band.jpg"), photo(null)]))).toBe(COLOUR_PORTRAIT_IDS);
  });

  it("gives a collage the colour set, never a mix", () => {
    expect(portraitSetForPage(page([photo(null), photo(null)]))).toBe(COLOUR_PORTRAIT_IDS);
  });
});

describe("portraitRotationFor", () => {
  it("lists the cover's set once, starting with this seed's pick", () => {
    const cover = page([photo("/spray.png"), photo(null)]);
    const rotation = portraitRotationFor(cover, "quiet-modern");
    expect([...rotation].sort()).toEqual([...COLOUR_PORTRAIT_IDS].sort());
    expect(rotation[0]).toBe(portraitIdForSeed("quiet-modern", COLOUR_PORTRAIT_IDS));
  });
});

describe("studio portraits", () => {
  it("never enter the automatic sets, so existing templates keep their faces", () => {
    for (const id of STUDIO_PORTRAIT_IDS) {
      expect(MONO_PORTRAIT_IDS as readonly string[]).not.toContain(id);
      expect(COLOUR_PORTRAIT_IDS as readonly string[]).not.toContain(id);
    }
  });

  it("can be pinned, and rotate within their own set", () => {
    const rotation = portraitRotationFor(page([photo(null)]), "golf", "portrait-15");
    expect(rotation[0]).toBe("portrait-15");
    expect([...rotation].sort()).toEqual([...STUDIO_PORTRAIT_IDS].sort());
  });

  it("each record who they show", () => {
    expect(Object.keys(STUDIO_PORTRAIT_GENDER).sort()).toEqual([...STUDIO_PORTRAIT_IDS].sort());
  });
});

describe("older studio portraits", () => {
  it("never enter the automatic sets, so existing templates keep their faces", () => {
    for (const id of ELDER_PORTRAIT_IDS) {
      expect(MONO_PORTRAIT_IDS as readonly string[]).not.toContain(id);
      expect(COLOUR_PORTRAIT_IDS as readonly string[]).not.toContain(id);
    }
  });

  it("can be pinned, and rotate within their own set", () => {
    const rotation = portraitRotationFor(page([photo(null)]), "golf", "portrait-30");
    expect(rotation[0]).toBe("portrait-30");
    expect([...rotation].sort()).toEqual([...ELDER_PORTRAIT_IDS].sort());
  });

  it("each record who they show, the same as their younger twin", () => {
    expect(Object.keys(ELDER_PORTRAIT_GENDER).sort()).toEqual([...ELDER_PORTRAIT_IDS].sort());
    ELDER_PORTRAIT_IDS.forEach((id, index) =>
      expect(ELDER_PORTRAIT_GENDER[id], id).toBe(STUDIO_PORTRAIT_GENDER[STUDIO_PORTRAIT_IDS[index]]),
    );
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

  it("anchors a stand-in to the top of its window, so a squarer window doesn't crop the head", () => {
    const filled = withPlaceholderPhotos(
      page([{ id: "a", type: "image", src: null, x: 0, y: 0, w: 10, h: 10 }]),
      "/portrait.jpg",
    );
    const el = filled.elements[0];
    expect(el.type === "image" && el.crop).toEqual(PLACEHOLDER_CROP);
    expect(PLACEHOLDER_CROP).toEqual({ x: 50, y: 0, zoom: 1 });
  });

  it("keeps a window's own crop, and leaves artwork's crop alone", () => {
    const own = { x: 30, y: 40, zoom: 1.5 };
    const filled = withPlaceholderPhotos(
      page([
        { id: "a", type: "image", src: null, crop: own, x: 0, y: 0, w: 10, h: 10 },
        { id: "b", type: "image", src: "/spray.png", x: 0, y: 0, w: 10, h: 10 },
      ]),
      "/portrait.jpg",
    );
    const [a, b] = filled.elements;
    expect(a.type === "image" && a.crop).toEqual(own);
    expect(b.type === "image" && b.crop).toBeUndefined();
  });

  it("never mutates the page it was given — the stored layout keeps its nulls", () => {
    const original = page([{ id: "a", type: "image", src: null, x: 0, y: 0, w: 10, h: 10 }]);
    withPlaceholderPhotos(original, "/portrait.jpg");
    expect(original.elements[0].type === "image" && original.elements[0].src).toBeNull();
  });

  it("cycles portraits across a collage rather than repeating one face", () => {
    const collage = page(
      Array.from({ length: 4 }, (_, i) => ({
        id: `i${i}`,
        type: "image" as const,
        src: null,
        x: 0,
        y: 0,
        w: 10,
        h: 10,
      })),
    );
    const filled = withPlaceholderPhotos(collage, ["/a.jpg", "/b.jpg", "/c.jpg"]);
    const srcs = filled.elements.map((el) => (el.type === "image" ? el.src : null));
    expect(srcs).toEqual(["/a.jpg", "/b.jpg", "/c.jpg", "/a.jpg"]);
  });

  it("does not consume a portrait on a window that already has artwork", () => {
    const mixed = page([
      { id: "bg", type: "image", src: "/bg.jpg", x: 0, y: 0, w: 10, h: 10 },
      { id: "p1", type: "image", src: null, x: 0, y: 0, w: 10, h: 10 },
      { id: "p2", type: "image", src: null, x: 0, y: 0, w: 10, h: 10 },
    ]);
    const filled = withPlaceholderPhotos(mixed, ["/a.jpg", "/b.jpg"]);
    const srcs = filled.elements.map((el) => (el.type === "image" ? el.src : null));
    expect(srcs).toEqual(["/bg.jpg", "/a.jpg", "/b.jpg"]);
  });

  it("fills the photo window on a real generated cover", () => {
    const spec = TEMPLATE_SPECS.find((s) => s.archetype === "keepsake")!;
    const [cover] = buildTemplateLayout(spec, { sprayUrl: "/spray.png" });
    const filled = withPlaceholderPhotos(cover, "/portrait.jpg");
    expect(filled.elements.some((el) => el.type === "image" && el.src === "/portrait.jpg")).toBe(true);
    expect(filled.elements.some((el) => el.type === "image" && el.src === null)).toBe(false);
  });
});

describe("portraitRotationFor with an admin's pick", () => {
  it("starts with the chosen portrait, from the set it belongs to", () => {
    // A plain cover would be monochrome; a colour pick overrides that.
    const rotation = portraitRotationFor(page([photo(null)]), "any", "portrait-7");
    expect(rotation[0]).toBe("portrait-7");
    expect([...rotation].sort()).toEqual([...COLOUR_PORTRAIT_IDS].sort());
  });

  it("falls back to the automatic pick for null or an unknown id", () => {
    const cover = page([photo(null)]);
    expect(portraitRotationFor(cover, "s", null)).toEqual(portraitRotationFor(cover, "s"));
    expect(portraitRotationFor(cover, "s", "nope")).toEqual(portraitRotationFor(cover, "s"));
  });
});
