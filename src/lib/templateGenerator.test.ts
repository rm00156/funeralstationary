import { describe, expect, it } from "vitest";
import { TEMPLATE_PAGE_COUNT } from "@/lib/designEditor";
import {
  ARCHETYPE_IDS,
  TEMPLATE_PALETTES,
  TEMPLATE_SPECS,
  TEMPLATE_TYPE_SETS,
  buildTemplateLayout,
  slugForName,
  styleFor,
  type TemplateSpec,
} from "@/lib/templateGenerator";
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
      expect(parseLayoutPages(buildTemplateLayout(entry)).ok, entry.slug).toBe(true);
    }
  });

  it("covers every archetype, so the catalogue is not one design recoloured", () => {
    const used = new Set(TEMPLATE_SPECS.map((entry) => entry.archetype));
    expect(used.size).toBe(ARCHETYPE_IDS.length);
  });

  it("gives every spec at least one category", () => {
    for (const entry of TEMPLATE_SPECS) {
      expect(entry.categories.length, entry.slug).toBeGreaterThan(0);
    }
  });
});
