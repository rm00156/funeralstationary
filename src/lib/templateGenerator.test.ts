import { describe, expect, it } from "vitest";
import { TEMPLATE_PAGE_COUNT } from "@/lib/designEditor";
import {
  ARCHETYPE_IDS,
  ARTWORK_ARCHETYPE_IDS,
  SPRAY_ARCHETYPE_IDS,
  TEMPLATE_PALETTES,
  TEMPLATE_SPECS,
  TEMPLATE_TYPE_SETS,
  buildTemplateLayout,
  isArtworkArchetype,
  isSprayArchetype,
  slugForName,
  styleFor,
  type TemplateSpec,
} from "@/lib/templateGenerator";
import { getBackgroundSpec } from "@/lib/backgroundArtwork";
import { parseLayoutPages } from "@/lib/adminValidation";

const spec = (patch: Partial<TemplateSpec> = {}): TemplateSpec => ({
  slug: "test-template",
  name: "Test Template",
  archetype: "framed",
  palette: "plum",
  typeSet: "classic",
  icon: "flower",
  categories: ["classic"],
  ...patch,
});

describe("slugForName", () => {
  it("kebab-cases a display name", () => {
    expect(slugForName("Whispering Petals")).toBe("whispering-petals");
    expect(slugForName("Tide and Time")).toBe("tide-and-time");
  });

  it("strips punctuation rather than leaving stray hyphens", () => {
    expect(slugForName("  Amber — Evening!  ")).toBe("amber-evening");
  });
});

describe("buildTemplateLayout", () => {
  it("builds exactly a cover, middle and back page for every archetype", () => {
    for (const archetype of ARCHETYPE_IDS) {
      const pages = buildTemplateLayout(spec({ archetype }));
      expect(pages, archetype).toHaveLength(TEMPLATE_PAGE_COUNT);
      // The middle page is what repeats, so it must carry the running order.
      expect(
        pages[1].elements.some((el) => el.type === "text" && el.text === "Order of Service"),
        archetype,
      ).toBe(true);
    }
  });

  it("gives every cover a photo placeholder for the customer to fill", () => {
    for (const archetype of ARCHETYPE_IDS) {
      const [cover] = buildTemplateLayout(spec({ archetype }));
      const image = cover.elements.find((el) => el.type === "image");
      expect(image, archetype).toBeDefined();
      expect(image!.type === "image" && image!.src).toBeNull();
    }
  });

  it("produces output the admin layout validator accepts", () => {
    for (const archetype of ARCHETYPE_IDS) {
      const result = parseLayoutPages(buildTemplateLayout(spec({ archetype })));
      expect(result.ok, archetype).toBe(true);
    }
  });

  it("gives every page and element a unique id", () => {
    const pages = buildTemplateLayout(spec());
    const ids = [...pages.map((p) => p.id), ...pages.flatMap((p) => p.elements.map((e) => e.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applies the spec's palette, type set and motif throughout", () => {
    const pages = buildTemplateLayout(spec({ palette: "forest", typeSet: "prata", icon: "tree" }));
    const style = styleFor(spec({ palette: "forest", typeSet: "prata", icon: "tree" }));

    for (const page of pages) expect(page.background).toBe(TEMPLATE_PALETTES.forest.paper);

    const elements = pages.flatMap((page) => page.elements);
    expect(elements.some((el) => el.type === "clipart" && el.icon === "tree")).toBe(true);
    expect(
      elements.some((el) => el.type === "text" && el.fontFamily === TEMPLATE_TYPE_SETS.prata.heading),
    ).toBe(true);
    expect(style.accent).toBe(TEMPLATE_PALETTES.forest.accent);
  });

  it("keeps round photos square so they do not print as ovals", () => {
    const [cover] = buildTemplateLayout(spec({ archetype: "framed" }));
    const image = cover.elements.find((el) => el.type === "image");
    expect(image!.shape).toBe("oval");
    // A square on a 148x210mm page means h% = w% * 148/210.
    expect(image!.h).toBeCloseTo((image!.w * 148) / 210, 5);
  });

  it("gives the arch archetype a portrait arch window", () => {
    const [cover] = buildTemplateLayout(spec({ archetype: "arch" }));
    const image = cover.elements.find((el) => el.type === "image");
    expect(image!.shape).toBe("arch");
    // Taller in print mm than the semicircle's radius (half the width), so the
    // straight sides are visible and the window reads as an arch, not an oval.
    expect((image!.h / 100) * 210).toBeGreaterThan(((image!.w / 100) * 148) / 2);
  });
});

describe("artwork templates", () => {
  const artworkSpec = (overrides: Partial<TemplateSpec> = {}): TemplateSpec => ({
    ...spec(),
    archetype: "artwork",
    background: "redoute-frankfort-rose",
    palette: "plum",
    ...overrides,
  });

  it("puts a locked full-bleed background first on the cover and back page, not the middle", () => {
    const pages = buildTemplateLayout(artworkSpec(), { backgroundUrl: "/bg.jpg" });
    for (const index of [0, 2]) {
      const first = pages[index].elements[0];
      expect(first.type).toBe("image");
      expect(first.locked).toBe(true);
      expect(first.type === "image" && first.src).toBe("/bg.jpg");
      expect(first.x).toBeLessThan(0);
    }
    expect(pages[1].elements.some((el) => el.locked)).toBe(false);
    expect(parseLayoutPages(pages).ok).toBe(true);
  });

  it("gives the portrait variant an empty photo placeholder above the background", () => {
    const [cover] = buildTemplateLayout(artworkSpec({ archetype: "artwork-portrait" }), {
      backgroundUrl: "/bg.jpg",
    });
    const placeholder = cover.elements.find((el) => el.type === "image" && el.src === null);
    expect(placeholder).toBeDefined();
    expect(cover.elements.indexOf(placeholder!)).toBeGreaterThan(0);
  });

  it("refuses to build without the rendered asset, an unknown background, or an unrendered palette", () => {
    expect(() => buildTemplateLayout(artworkSpec())).toThrow(/backgroundUrl/);
    expect(() =>
      buildTemplateLayout(artworkSpec({ background: "nope" }), { backgroundUrl: "/bg.jpg" }),
    ).toThrow(/unknown background/);
    expect(() =>
      buildTemplateLayout(artworkSpec({ palette: "ink" }), { backgroundUrl: "/bg.jpg" }),
    ).toThrow(/not rendered for palette/);
    expect(() =>
      buildTemplateLayout(artworkSpec({ background: undefined }), { backgroundUrl: "/bg.jpg" }),
    ).toThrow(/no background/);
  });
});

describe("TEMPLATE_SPECS", () => {
  it("has unique slugs", () => {
    const slugs = TEMPLATE_SPECS.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("derives each slug from its name", () => {
    for (const entry of TEMPLATE_SPECS) {
      expect(entry.slug).toBe(slugForName(entry.name));
    }
  });

  it("builds a valid layout for every curated spec", () => {
    for (const entry of TEMPLATE_SPECS) {
      const pages = buildTemplateLayout(entry, {
        backgroundUrl: "/bg.jpg",
        sprayUrl: "/spray.png",
      });
      expect(parseLayoutPages(pages).ok, entry.slug).toBe(true);
    }
  });

  it("uses every artwork archetype and only backgrounds rendered for the spec's palette", () => {
    const artwork = TEMPLATE_SPECS.filter((entry) => isArtworkArchetype(entry.archetype));
    expect(new Set(artwork.map((entry) => entry.archetype)).size).toBe(ARTWORK_ARCHETYPE_IDS.length);
    for (const entry of artwork) {
      const background = getBackgroundSpec(entry.background ?? "");
      expect(background, entry.slug).toBeDefined();
      expect(background!.palettes, entry.slug).toContain(entry.palette);
    }
  });

  it("only builds spray templates on backgrounds that have a cutout", () => {
    const sprays = TEMPLATE_SPECS.filter((entry) => isSprayArchetype(entry.archetype));
    expect(new Set(sprays.map((entry) => entry.archetype)).size).toBe(SPRAY_ARCHETYPE_IDS.length);
    for (const entry of sprays) {
      const background = getBackgroundSpec(entry.background ?? "");
      expect(background, entry.slug).toBeDefined();
      expect(background!.spray, entry.slug).toBeDefined();
    }
  });

  it("makes the photograph the subject of every spray cover", () => {
    for (const entry of TEMPLATE_SPECS.filter((e) => isSprayArchetype(e.archetype))) {
      const [cover] = buildTemplateLayout(entry, { sprayUrl: "/spray.png" });
      const photo = cover.elements.find((el) => el.type === "image" && el.src === null);
      expect(photo, entry.slug).toBeDefined();
      const sprays = cover.elements.filter((el) => el.type === "image" && el.src !== null);
      expect(sprays.length, entry.slug).toBeGreaterThan(0);
      // Every spray is locked artwork that fits rather than crops, and the
      // photo outweighs any single one of them.
      for (const spray of sprays) {
        expect(spray.locked, entry.slug).toBe(true);
        expect(spray.type === "image" && spray.fit, entry.slug).toBe("contain");
        expect(photo!.w * photo!.h, entry.slug).toBeGreaterThan(spray.w * spray.h);
      }
    }
  });

  it("never puts two templates on the same picture in the same palette", () => {
    const keys = TEMPLATE_SPECS.filter((entry) => entry.background).map(
      (entry) => `${entry.background}/${entry.palette}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers every archetype, so the catalogue is not one design recoloured", () => {
    const used = new Set(TEMPLATE_SPECS.map((entry) => entry.archetype));
    expect(used.size).toBe(
      ARCHETYPE_IDS.length + ARTWORK_ARCHETYPE_IDS.length + SPRAY_ARCHETYPE_IDS.length,
    );
  });

  it("gives every spec at least one category", () => {
    for (const entry of TEMPLATE_SPECS) {
      expect(entry.categories.length, entry.slug).toBeGreaterThan(0);
    }
  });
});
