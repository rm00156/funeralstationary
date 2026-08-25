import { describe, expect, it } from "vitest";
import {
  instantiateLayout,
  makeBlankPage,
  makeStarterDoc,
  templateAccent,
  withPageCount,
} from "@/lib/designEditor";
import type { Template } from "@/lib/templates";

function makeTemplate(categories: string[]): Template {
  return {
    id: "t1",
    name: "Test Template",
    categories,
    productId: "order-of-service",
    image: "",
  };
}

describe("templateAccent", () => {
  it("returns the accent for the template's first matching category", () => {
    expect(templateAccent(makeTemplate(["floral"]))).toBe("#6b2d6a");
  });

  it("prefers the DB-loaded accent over the static category map", () => {
    expect(templateAccent({ ...makeTemplate(["floral"]), accent: "#123456" })).toBe(
      "#123456",
    );
  });

  it("falls back to the default ink colour for an unknown category", () => {
    expect(templateAccent(makeTemplate(["unknown-category"]))).toBe("#1f1a1e");
  });
});

describe("makeStarterDoc", () => {
  it("builds a cover, order-of-service, and back page for a 3-page document", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 3);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0].elements.some((el) => el.type === "image")).toBe(true);
    expect(
      doc.pages[1].elements.some(
        (el) => el.type === "text" && el.text === "Order of Service",
      ),
    ).toBe(true);
    expect(doc.pages[2].elements.some((el) => el.type === "clipart")).toBe(true);
  });

  it("fills any pages between the cover and back page as blank", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 4);
    expect(doc.pages[2].elements).toHaveLength(0);
  });
});

describe("instantiateLayout", () => {
  const layout = makeStarterDoc(makeTemplate(["classic"]), 3).pages;

  it("deep-clones the layout with fresh page and element ids", () => {
    const doc = instantiateLayout("my-template", layout, 3);
    expect(doc.templateId).toBe("my-template");
    expect(doc.pages).toHaveLength(3);
    for (const [index, page] of doc.pages.entries()) {
      expect(page.id).not.toBe(layout[index].id);
      expect(page.elements).toHaveLength(layout[index].elements.length);
      for (const [elementIndex, element] of page.elements.entries()) {
        expect(element.id).not.toBe(layout[index].elements[elementIndex].id);
      }
    }
    // Mutating the instance must never write through to the source layout.
    doc.pages[0].elements.pop();
    expect(layout[0].elements.length).toBeGreaterThan(doc.pages[0].elements.length);
  });

  it("reconciles to the requested page count", () => {
    expect(instantiateLayout("t", layout, 2).pages).toHaveLength(2);
    const grown = instantiateLayout("t", layout, 5);
    expect(grown.pages).toHaveLength(5);
    expect(grown.pages[4].elements).toHaveLength(0);
  });
});

describe("withPageCount", () => {
  it("returns the same document when the page count is unchanged", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 2);
    expect(withPageCount(doc, 2)).toBe(doc);
  });

  it("truncates pages when shrinking", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 3);
    expect(withPageCount(doc, 2).pages).toHaveLength(2);
  });

  it("appends blank pages when growing", () => {
    const doc = { templateId: "t1", pages: [makeBlankPage()] };
    const grown = withPageCount(doc, 3);
    expect(grown.pages).toHaveLength(3);
    expect(grown.pages[1].elements).toHaveLength(0);
    expect(grown.pages[2].elements).toHaveLength(0);
  });
});
