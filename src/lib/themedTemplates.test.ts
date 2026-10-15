import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLIPARTS } from "@/components/PageCanvas";
import { parseLayoutPages } from "@/lib/adminValidation";
import { CLASSIC_TEMPLATE_SPECS } from "@/lib/classicTemplates";
import { TEMPLATE_PAGE_COUNT, type CanvasElement, type TextElement } from "@/lib/designEditor";
import { FLAT_TEMPLATE_SPECS } from "@/lib/flatTemplates";
import {
  ELDER_PORTRAIT_GENDER,
  ELDER_PORTRAIT_IDS,
  STUDIO_PORTRAIT_GENDER,
  STUDIO_PORTRAIT_IDS,
  SUBJECT_PORTRAIT_IDS,
  isPlaceholderPortraitId,
} from "@/lib/placeholderPortraits";
import { CATEGORIES } from "@/db/seedCatalogue";
import { PLACEHOLDER_INTERIOR, PLACEHOLDER_NAME, TEMPLATE_SPECS } from "@/lib/templateGenerator";
import {
  ARTWORK_PATH,
  THEMED_DESIGN_IDS,
  ELDER_PEOPLE,
  PET_YEARS,
  STUDIO_PEOPLE,
  SUBJECT_PEOPLE,
  THEMED_TEMPLATE_SPECS,
  buildThemedLayout,
  personalise,
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

describe("personalise", () => {
  const sue = STUDIO_PEOPLE["portrait-12"];

  it("names every template after its own portrait, and keeps the name a placeholder", () => {
    for (const spec of THEMED_TEMPLATE_SPECS) {
      const cover = texts(buildThemedLayout(spec.design, urls, spec.person)[0].elements);
      const name = cover.find((t) => t.text === spec.person.name);
      expect(name?.placeholder, spec.slug).toBe(true);
      expect(cover.some((t) => t.text === PLACEHOLDER_NAME), spec.slug).toBe(spec.person.name === PLACEHOLDER_NAME);
    }
  });

  it("matches the person's gender wherever the wording has one", () => {
    const pages = personalise(buildThemedLayout("red-sunset", urls), sue);
    expect(texts(pages[0].elements).map((t) => t.text)).toContain("a very special wife and friend");
    const bob = personalise(buildThemedLayout("red-sunset", urls), STUDIO_PEOPLE["portrait-13"]);
    expect(texts(bob[0].elements).map((t) => t.text)).toContain("a very special husband and friend");
  });

  it("carries the nickname too", () => {
    const pages = personalise(buildThemedLayout("cross-doves", urls), sue);
    expect(texts(pages[0].elements).map((t) => t.text)).toContain("(fondly known as Sue)");
  });

  it("gives every studio portrait a person of the same gender", () => {
    for (const [id, who] of Object.entries(STUDIO_PEOPLE)) {
      expect(who.gender, id).toBe(STUDIO_PORTRAIT_GENDER[id as keyof typeof STUDIO_PORTRAIT_GENDER]);
    }
  });

  it("shows each older studio portrait as its younger twin, so a switch changes no wording", () => {
    ELDER_PORTRAIT_IDS.forEach((id, index) => {
      expect(ELDER_PEOPLE[id], id).toEqual(STUDIO_PEOPLE[STUDIO_PORTRAIT_IDS[index]]);
      expect(ELDER_PEOPLE[id].gender, id).toBe(ELDER_PORTRAIT_GENDER[id]);
    });
  });

  it("previews every adult template with a face of its sample person's gender", () => {
    const genders: Record<string, string> = { ...STUDIO_PORTRAIT_GENDER, ...ELDER_PORTRAIT_GENDER };
    for (const spec of THEMED_TEMPLATE_SPECS.filter((s) => s.portrait in genders)) {
      expect(spec.person.gender, spec.slug).toBe(genders[spec.portrait]);
    }
  });

  it("uses the older faces for the faith and heritage covers, the younger for most sport", () => {
    const portrait = (slug: string) => THEMED_TEMPLATE_SPECS.find((s) => s.slug === slug)?.portrait;
    for (const slug of ["celtic-cross", "candlelight", "french", "golden-sunset", "grand-piano", "golf"]) {
      expect(ELDER_PORTRAIT_IDS as readonly string[], slug).toContain(portrait(slug));
    }
    for (const slug of ["football", "rugby", "basketball", "karate-grey", "bob-marley", "lgbt"]) {
      expect(STUDIO_PORTRAIT_IDS as readonly string[], slug).toContain(portrait(slug));
    }
  });
});

describe("child and pet covers", () => {
  it("previews every pet and the child with a subject stand-in, not an adult", () => {
    for (const spec of THEMED_TEMPLATE_SPECS.filter((s) => s.categories.some((c) => c === "pets" || c === "child"))) {
      expect(SUBJECT_PORTRAIT_IDS as readonly string[], spec.slug).toContain(spec.portrait);
    }
  });

  it("names a pet cover after its pet, with its years flagged to replace", () => {
    const cover = texts(buildThemedLayout("rabbit-blue", urls, SUBJECT_PEOPLE["portrait-23"])[0].elements);
    expect(cover.find((t) => t.text === "Bramble")?.placeholder).toBe(true);
    expect(cover.find((t) => t.text === PET_YEARS)?.placeholder).toBe(true);
  });

  it("gives every subject stand-in a sample name", () => {
    for (const id of SUBJECT_PORTRAIT_IDS) expect(SUBJECT_PEOPLE[id].name, id).toBeTruthy();
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
