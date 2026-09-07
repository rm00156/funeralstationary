import { describe, expect, it } from "vitest";
import {
  BACKGROUND_SPECS,
  backgroundAssetKey,
  backgroundElement,
  getBackgroundSpec,
  mergeCredits,
} from "./backgroundArtwork";
import { FULL_BLEED_BOX } from "./designEditor";
import { TEMPLATE_PALETTES } from "./templateGenerator";

describe("BACKGROUND_SPECS", () => {
  it("has unique, slug-shaped ids", () => {
    const ids = BACKGROUND_SPECS.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("only references palettes the generator knows", () => {
    for (const spec of BACKGROUND_SPECS) {
      expect(spec.palettes.length).toBeGreaterThan(0);
      for (const palette of spec.palettes) expect(TEMPLATE_PALETTES).toHaveProperty(palette);
    }
  });

  it("records a licence and credit for every image", () => {
    for (const spec of BACKGROUND_SPECS) {
      expect(spec.licence.length).toBeGreaterThan(0);
      expect(spec.credit.length).toBeGreaterThan(0);
    }
  });

  it("fades run from artwork toward the edge the text sits on", () => {
    for (const spec of BACKGROUND_SPECS) {
      if (!spec.fade) continue;
      expect(spec.fade.edge).toBe(spec.textZone);
      if (spec.fade.edge === "bottom") expect(spec.fade.start).toBeLessThan(spec.fade.end);
      else expect(spec.fade.start).toBeGreaterThan(spec.fade.end);
      expect(spec.fade.start).toBeGreaterThanOrEqual(0);
      expect(spec.fade.end).toBeLessThanOrEqual(100);
    }
  });

  it("keeps focus within the source image", () => {
    for (const spec of BACKGROUND_SPECS) {
      if (!spec.focus) continue;
      expect(spec.focus.x).toBeGreaterThanOrEqual(0);
      expect(spec.focus.x).toBeLessThanOrEqual(1);
      expect(spec.focus.y).toBeGreaterThanOrEqual(0);
      expect(spec.focus.y).toBeLessThanOrEqual(1);
    }
  });

  it("looks specs up by id", () => {
    expect(getBackgroundSpec(BACKGROUND_SPECS[0].id)).toBe(BACKGROUND_SPECS[0]);
    expect(getBackgroundSpec("nope")).toBeUndefined();
  });
});

describe("mergeCredits", () => {
  const first = BACKGROUND_SPECS[0];

  it("records every manifest entry even when only one was fetched", () => {
    const merged = mergeCredits([], [
      { id: first.id, name: first.name, licence: first.licence, credit: first.credit, sourceUrl: "https://example.test/a" },
    ]);
    expect(merged).toHaveLength(BACKGROUND_SPECS.length);
    expect(merged.map((entry) => entry.id)).toEqual(BACKGROUND_SPECS.map((spec) => spec.id));
    expect(merged.find((entry) => entry.id === first.id)!.sourceUrl).toBe("https://example.test/a");
  });

  it("keeps a source URL recorded by an earlier run", () => {
    const existing = [
      { id: first.id, name: "old", licence: "old", credit: "old", sourceUrl: "https://example.test/old" },
    ];
    const merged = mergeCredits(existing, []);
    const entry = merged.find((e) => e.id === first.id)!;
    expect(entry.sourceUrl).toBe("https://example.test/old");
    // Name, licence and credit always come from the manifest, never the file.
    expect(entry.licence).toBe(first.licence);
  });

  it("drops entries for backgrounds no longer in the manifest", () => {
    const merged = mergeCredits(
      [{ id: "removed-background", name: "x", licence: "x", credit: "x", sourceUrl: "x" }],
      [],
    );
    expect(merged.some((entry) => entry.id === "removed-background")).toBe(false);
  });
});

describe("backgroundAssetKey", () => {
  it("is deterministic per background and palette", () => {
    expect(backgroundAssetKey("redoute-frankfort-rose", "plum")).toBe(
      "templates/backgrounds/redoute-frankfort-rose-plum.jpg",
    );
  });
});

describe("backgroundElement", () => {
  it("is a locked image covering the whole artboard including bleed", () => {
    const element = backgroundElement("/templates/backgrounds/x-plum.jpg");
    expect(element.type).toBe("image");
    expect(element.locked).toBe(true);
    expect(element.src).toBe("/templates/backgrounds/x-plum.jpg");
    expect(element.x).toBe(FULL_BLEED_BOX.x);
    expect(element.y).toBe(FULL_BLEED_BOX.y);
    expect(element.w).toBe(FULL_BLEED_BOX.w);
    expect(element.h).toBe(FULL_BLEED_BOX.h);
    expect(element.x).toBeLessThan(0);
    expect(element.x + element.w).toBeGreaterThan(100);
  });

  it("mints a fresh id each time", () => {
    expect(backgroundElement("a").id).not.toBe(backgroundElement("a").id);
  });
});
