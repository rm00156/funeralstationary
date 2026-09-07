import { describe, expect, it } from "vitest";

import type { CanvasElement, DesignDoc, DesignPage } from "@/lib/designEditor";
import {
  checkDesignReadiness,
  isDesignOrderable,
  needsDefaultsConfirmation,
} from "@/lib/designReadiness";

let seq = 0;
const id = () => `el-${(seq += 1)}`;

const text = (value: string, extra: Partial<CanvasElement> = {}): CanvasElement =>
  ({
    id: id(),
    type: "text",
    text: value,
    fontFamily: "body",
    fontSize: 14,
    align: "center",
    color: "#000000",
    x: 10,
    y: 10,
    w: 80,
    h: 0,
    ...extra,
  }) as CanvasElement;

const photo = (src: string | null, extra: Partial<CanvasElement> = {}): CanvasElement =>
  ({
    id: id(),
    type: "image",
    src,
    x: 20,
    y: 20,
    w: 60,
    h: 40,
    ...extra,
  }) as CanvasElement;

const page = (...elements: CanvasElement[]): DesignPage => ({
  id: id(),
  elements,
});

const doc = (...pages: DesignPage[]): DesignDoc => ({
  templateId: "classic",
  pages,
});

/** cover / middle / back, as every stored template layout is. */
const template: DesignPage[] = [
  page(text("In loving memory"), text("Name Surname"), photo(null)),
  page(text("Order of Service")),
  page(text("Forever in our hearts")),
];

describe("checkDesignReadiness", () => {
  it("blocks a design with an empty photo window", () => {
    const readiness = checkDesignReadiness(
      doc(page(text("Jane Doe"), photo(null)), page(text("Hymn")), page(text("Thank you"))),
      template,
    );
    expect(readiness.blocking).toHaveLength(1);
    expect(readiness.blocking[0]).toMatchObject({
      kind: "empty-photo",
      page: 0,
      occurrences: 1,
    });
    expect(isDesignOrderable(readiness)).toBe(false);
  });

  it("passes a design whose photo windows are all filled", () => {
    const readiness = checkDesignReadiness(
      doc(
        page(text("Jane Doe"), photo("https://cdn.example/jane.jpg")),
        page(text("Hymn")),
        page(text("Thank you")),
      ),
      template,
    );
    expect(readiness.blocking).toEqual([]);
    expect(readiness.warnings).toEqual([]);
    expect(isDesignOrderable(readiness)).toBe(true);
  });

  it("never blocks on the template's own locked artwork", () => {
    // A locked element is template artwork the customer cannot touch, so a
    // broken one must not become their unfixable blocker.
    const readiness = checkDesignReadiness(
      doc(page(photo(null, { locked: true })), page(text("Hymn")), page(text("Thank you"))),
      template,
    );
    expect(readiness.blocking).toEqual([]);
  });

  it("warns about text left at the template's wording, without blocking", () => {
    const readiness = checkDesignReadiness(
      doc(
        page(text("In loving memory"), text("Jane Doe"), photo("https://cdn.example/j.jpg")),
        page(text("Hymn")),
        page(text("Thank you")),
      ),
      template,
    );
    expect(readiness.blocking).toEqual([]);
    expect(readiness.warnings).toHaveLength(1);
    expect(readiness.warnings[0]).toMatchObject({
      kind: "unchanged-text",
      page: 0,
    });
    expect(needsDefaultsConfirmation(readiness)).toBe(true);
    expect(isDesignOrderable(readiness)).toBe(true);
  });

  it("ignores whitespace and case when deciding whether text was edited", () => {
    const readiness = checkDesignReadiness(
      doc(
        page(text("  in loving\n  MEMORY  "), photo("https://cdn.example/j.jpg")),
        page(text("Hymn")),
        page(text("Thank you")),
      ),
      template,
    );
    expect(readiness.warnings).toHaveLength(1);
  });

  it("compares each page only against the template page it came from", () => {
    // The cover's wording moved to the back page is plainly a deliberate edit.
    const readiness = checkDesignReadiness(
      doc(
        page(text("Jane Doe"), photo("https://cdn.example/j.jpg")),
        page(text("Hymn")),
        page(text("In loving memory")),
      ),
      template,
    );
    expect(readiness.warnings).toEqual([]);
  });

  it("reports a repeated interior page once, with a count", () => {
    // Interior pages are copies of the one authored middle page, so an
    // untouched booklet would otherwise report the same line a dozen times.
    const readiness = checkDesignReadiness(
      doc(
        page(text("Jane Doe"), photo("https://cdn.example/j.jpg")),
        page(text("Order of Service")),
        page(text("Order of Service")),
        page(text("Order of Service")),
        page(text("Thank you")),
      ),
      template,
    );
    expect(readiness.warnings).toHaveLength(1);
    expect(readiness.warnings[0]).toMatchObject({ occurrences: 3, page: 1 });
  });

  it("still blocks empty photos when the source template is unknown", () => {
    // An archived template has no layout to compare against, but an empty
    // photo window is unprintable regardless of where it came from.
    const readiness = checkDesignReadiness(doc(page(text("In loving memory"), photo(null))), null);
    expect(readiness.blocking).toHaveLength(1);
    expect(readiness.warnings).toEqual([]);
  });

  it("does not warn about empty text runs", () => {
    const readiness = checkDesignReadiness(
      doc(page(text(""), photo("https://cdn.example/j.jpg")), page(text("Hymn")), page(text("x"))),
      [page(text("")), page(text("Order of Service")), page(text("Forever in our hearts"))],
    );
    expect(readiness.warnings).toEqual([]);
  });
});
