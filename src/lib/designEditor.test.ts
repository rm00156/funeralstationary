import { describe, expect, it } from "vitest";
import {
  PAGE_H,
  PAGE_W,
  RESIZE_HANDLES,
  TEMPLATE_PAGE_COUNT,
  imageShape,
  instantiateLayout,
  makeBlankPage,
  makeStarterDoc,
  makeTemplateLayout,
  photoBorderRadius,
  resizeBox,
  templateAccent,
  templatePageLabel,
  toTemplateLayout,
  withPageCount,
  type ImageElement,
  type ResizeHandle,
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

function makeImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return { id: "i1", type: "image", src: null, x: 30, y: 27, w: 40, h: 28.2, ...overrides };
}

describe("imageShape", () => {
  it("treats the legacy round flag as an oval window", () => {
    expect(imageShape(makeImage({ round: true }))).toBe("oval");
  });

  it("defaults to a rectangular window", () => {
    expect(imageShape(makeImage())).toBe("rect");
  });

  it("prefers an explicit shape over a stale round flag", () => {
    expect(imageShape(makeImage({ round: true, shape: "arch" }))).toBe("arch");
  });
});

describe("photoBorderRadius", () => {
  it("clips an oval window with a 50% radius", () => {
    expect(photoBorderRadius(makeImage({ shape: "oval" }))).toBe("50%");
  });

  it("gives an arch window a semicircular top of half the box width", () => {
    const r = ((40 / 100) * PAGE_W) / 2;
    expect(photoBorderRadius(makeImage({ shape: "arch", w: 40 }))).toBe(`${r}px ${r}px 0 0`);
  });

  it("leaves a rectangular window unclipped", () => {
    expect(photoBorderRadius(makeImage())).toBeUndefined();
  });
});

describe("makeStarterDoc", () => {
  it("builds a cover, generic interior, and back page for a 3-page document", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 3);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0].elements.some((el) => el.type === "image")).toBe(true);
    const cover = doc.pages[0].elements.find((el) => el.type === "image");
    expect(cover!.shape).toBe("oval");
    expect(
      doc.pages[1].elements.some(
        (el) => el.type === "text" && el.text === "YOUR TEXT HERE",
      ),
    ).toBe(true);
    expect(doc.pages[2].elements.some((el) => el.type === "clipart")).toBe(true);
  });

  it("repeats the generic interior page for every interior page", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 5);
    for (const page of doc.pages.slice(1, -1)) {
      expect(page.elements.some((el) => el.type === "text" && el.text === "YOUR TEXT HERE")).toBe(
        true,
      );
      // Nothing service-specific may live on the page that repeats: an order
      // of service is singular, so it would assert the service happens once
      // per interior page.
      expect(
        page.elements.some(
          (el) => el.type === "text" && /Order of Service|Hymn|Eulogy|Prayers/.test(el.text),
        ),
      ).toBe(false);
    }
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

  it("reconciles to the requested page count, keeping the back page last", () => {
    const shrunk = instantiateLayout("t", layout, 2);
    expect(shrunk.pages).toHaveLength(2);
    expect(shrunk.pages[1].elements.some((el) => el.type === "clipart")).toBe(true);

    const grown = instantiateLayout("t", layout, 5);
    expect(grown.pages).toHaveLength(5);
    expect(grown.pages[4].elements.some((el) => el.type === "clipart")).toBe(true);
    for (const page of grown.pages.slice(1, -1)) {
      expect(page.elements.some((el) => el.type === "text" && el.text === "YOUR TEXT HERE")).toBe(
        true,
      );
    }
  });
});

describe("makeTemplateLayout", () => {
  it("builds exactly a cover, middle and back page", () => {
    const layout = makeTemplateLayout(makeTemplate(["classic"]));
    expect(layout).toHaveLength(TEMPLATE_PAGE_COUNT);
    expect(layout[0].elements.some((el) => el.type === "image")).toBe(true);
    expect(
      layout[1].elements.some((el) => el.type === "text" && el.text === "YOUR TEXT HERE"),
    ).toBe(true);
    expect(layout[2].elements.some((el) => el.type === "clipart")).toBe(true);
  });
});

describe("templatePageLabel", () => {
  it("names the three authored pages by role", () => {
    expect(templatePageLabel(0)).toBe("Cover");
    expect(templatePageLabel(1)).toBe("Middle");
    expect(templatePageLabel(2)).toBe("Back");
  });
});

describe("toTemplateLayout", () => {
  it("passes a three-page layout through untouched", () => {
    const layout = makeTemplateLayout(makeTemplate(["classic"]));
    expect(toTemplateLayout(layout)).toBe(layout);
  });

  it("returns null for a null or empty layout", () => {
    expect(toTemplateLayout(null)).toBeNull();
    expect(toTemplateLayout([])).toBeNull();
  });

  it("collapses a longer layout to cover, first interior page, and back", () => {
    const pages = makeStarterDoc(makeTemplate(["classic"]), 6).pages;
    const layout = toTemplateLayout(pages)!;
    expect(layout).toHaveLength(TEMPLATE_PAGE_COUNT);
    expect(layout[0]).toBe(pages[0]);
    expect(layout[1]).toBe(pages[1]);
    expect(layout[2]).toBe(pages[5]);
  });

  it("pads a one- or two-page layout out to the full triple", () => {
    const cover = makeBlankPage();
    const back = makeBlankPage();
    expect(toTemplateLayout([cover])).toEqual([cover, expect.anything(), expect.anything()]);

    const fromPair = toTemplateLayout([cover, back])!;
    expect(fromPair[0]).toBe(cover);
    expect(fromPair[1].elements).toHaveLength(0);
    expect(fromPair[2]).toBe(back);
  });
});

describe("withPageCount", () => {
  it("returns the same document when the page count is unchanged", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 2);
    expect(withPageCount(doc, 2)).toBe(doc);
  });

  it("shrinks by dropping interior pages, never the back page", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 5);
    const shrunk = withPageCount(doc, 2);
    expect(shrunk.pages).toHaveLength(2);
    expect(shrunk.pages[0]).toBe(doc.pages[0]);
    expect(shrunk.pages[1].elements.some((el) => el.type === "clipart")).toBe(true);
  });

  it("grows by repeating the middle page, keeping cover and back fixed", () => {
    const doc = makeStarterDoc(makeTemplate(["classic"]), 4);
    const grown = withPageCount(doc, 6);
    expect(grown.pages).toHaveLength(6);
    expect(grown.pages[0]).toBe(doc.pages[0]);
    expect(grown.pages[5].elements.some((el) => el.type === "clipart")).toBe(true);
    for (const page of grown.pages.slice(1, -1)) {
      expect(page.elements.some((el) => el.type === "text" && el.text === "YOUR TEXT HERE")).toBe(
        true,
      );
    }
  });

  it("appends blank pages when growing a document with no established cover/back", () => {
    const doc = { templateId: "t1", pages: [makeBlankPage()] };
    const grown = withPageCount(doc, 3);
    expect(grown.pages).toHaveLength(3);
    expect(grown.pages[1].elements).toHaveLength(0);
    expect(grown.pages[2].elements).toHaveLength(0);
  });
});

describe("resizeBox", () => {
  const origin = { x: 20, y: 30, w: 40, h: 20 };

  it("grows right/down from the south-east handle, leaving the top-left pinned", () => {
    expect(resizeBox(origin, "se", 10, 5)).toEqual({ x: 20, y: 30, w: 50, h: 25 });
  });

  it("moves the origin from the north-west handle, leaving the bottom-right pinned", () => {
    const box = resizeBox(origin, "nw", -10, -5);
    expect(box).toEqual({ x: 10, y: 25, w: 50, h: 25 });
    expect(box.x + box.w).toBe(origin.x + origin.w);
    expect(box.y + box.h).toBe(origin.y + origin.h);
  });

  it("mixes edges for the north-east and south-west handles", () => {
    expect(resizeBox(origin, "ne", 10, 5)).toEqual({ x: 20, y: 35, w: 50, h: 15 });
    expect(resizeBox(origin, "sw", 10, 5)).toEqual({ x: 30, y: 30, w: 30, h: 25 });
  });

  it("clamps to the minimum size without flipping the box inside out", () => {
    const box = resizeBox(origin, "nw", 999, 999);
    expect(box.w).toBe(4);
    expect(box.h).toBe(1);
    expect(box.x + box.w).toBe(origin.x + origin.w);
    expect(box.y + box.h).toBe(origin.y + origin.h);

    const se = resizeBox(origin, "se", -999, -999);
    expect(se).toEqual({ x: 20, y: 30, w: 4, h: 1 });
  });

  it("ignores the vertical delta for auto-height (text) elements", () => {
    const text = { x: 20, y: 30, w: 40, h: 0 };
    expect(resizeBox(text, "nw", -10, -8, { autoHeight: true })).toEqual({
      x: 10,
      y: 30,
      w: 50,
      h: 0,
    });
    expect(resizeBox(text, "se", 10, 8, { autoHeight: true })).toEqual({
      x: 20,
      y: 30,
      w: 50,
      h: 0,
    });
  });

  it("leaves an unrotated box untouched by the rotation path", () => {
    expect(resizeBox(origin, "se", 10, 5, { rotation: 0 })).toEqual({
      x: 20,
      y: 30,
      w: 50,
      h: 25,
    });
  });

  it("maps the pointer delta into a rotated element's own axes", () => {
    // At 90deg the on-screen "down" drag runs along the element's own width.
    const box = resizeBox(origin, "se", 0, 20, { rotation: 90 });
    expect(box.w).toBeGreaterThan(origin.w);
    expect(box.h).toBeCloseTo(origin.h, 6);
  });

  it("inverts the delta for a 180deg element, so the handle still follows the cursor", () => {
    // Upside down, the south-east handle sits at the top-left on screen —
    // dragging it further up/left has to grow the box, not shrink it.
    const box = resizeBox(origin, "se", -10, -5, { rotation: 180 });
    expect(box.w).toBeCloseTo(50, 6);
    expect(box.h).toBeCloseTo(25, 6);
  });

  it("keeps the opposite corner pinned on screen while rotated", () => {
    for (const rotation of [30, 90, 137, 200, 315]) {
      for (const handle of RESIZE_HANDLES) {
        const box = resizeBox(origin, handle, 7, -4, { rotation });
        const anchor = oppositeCorner(handle);
        const before = screenCorner(origin, rotation, anchor);
        const after = screenCorner(box, rotation, anchor);
        expect(after.x).toBeCloseTo(before.x, 6);
        expect(after.y).toBeCloseTo(before.y, 6);
      }
    }
  });
});

/** The corner a resize from `handle` is supposed to leave pinned. */
function oppositeCorner(handle: ResizeHandle): ResizeHandle {
  return { nw: "se", ne: "sw", sw: "ne", se: "nw" }[handle] as ResizeHandle;
}

/**
 * Where a box corner actually lands on screen, in pixels, once the browser has
 * applied `rotate()` around the box's centre — the thing a pinned corner has
 * to hold still.
 */
function screenCorner(
  box: { x: number; y: number; w: number; h: number },
  rotation: number,
  corner: ResizeHandle,
) {
  const rad = (rotation * Math.PI) / 180;
  const cx = ((box.x + box.w / 2) / 100) * PAGE_W;
  const cy = ((box.y + box.h / 2) / 100) * PAGE_H;
  const px = ((corner === "nw" || corner === "sw" ? box.x : box.x + box.w) / 100) * PAGE_W;
  const py = ((corner === "nw" || corner === "ne" ? box.y : box.y + box.h) / 100) * PAGE_H;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}
