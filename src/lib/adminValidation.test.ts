import { describe, expect, it } from "vitest";
import {
  parseHexColour,
  parseLayoutAction,
  parseLayoutPages,
  parseMultiplier,
  parseOptionInput,
  optionNoteError,
  parseOptionPatch,
  pageCountFormatError,
  parsePageCount,
  parsePence,
  parseProductDescription,
  parseProductOccasion,
  parseSlugOrder,
  parseVatTreatment,
  parseSlug,
  sizeFormatError,
  formatSizesError,
} from "@/lib/adminValidation";

describe("parseSlug", () => {
  it("accepts kebab-case slugs", () => {
    expect(parseSlug("order-of-service")).toBe("order-of-service");
    expect(parseSlug("a5")).toBe("a5");
    expect(parseSlug("15")).toBe("15");
  });

  it("rejects uppercase, spaces, leading/trailing hyphens and non-strings", () => {
    expect(parseSlug("Order")).toBeNull();
    expect(parseSlug("two words")).toBeNull();
    expect(parseSlug("-leading")).toBeNull();
    expect(parseSlug("trailing-")).toBeNull();
    expect(parseSlug("")).toBeNull();
    expect(parseSlug(42)).toBeNull();
    expect(parseSlug("a".repeat(65))).toBeNull();
  });
});

describe("parsePence", () => {
  it("accepts non-negative integers only", () => {
    expect(parsePence(0)).toBe(0);
    expect(parsePence(3299)).toBe(3299);
    expect(parsePence(-1)).toBeNull();
    expect(parsePence(12.5)).toBeNull();
    expect(parsePence("3299")).toBeNull();
  });
});

describe("parseMultiplier", () => {
  it("normalises to the 4dp string the DB stores", () => {
    expect(parseMultiplier(0.9)).toBe("0.9000");
    expect(parseMultiplier(1)).toBe("1.0000");
    expect(parseMultiplier(1.05)).toBe("1.0500");
  });

  it("rejects zero, negatives, out-of-range and >4dp values", () => {
    expect(parseMultiplier(0)).toBeNull();
    expect(parseMultiplier(-0.5)).toBeNull();
    expect(parseMultiplier(100)).toBeNull();
    expect(parseMultiplier(0.00001)).toBeNull();
    expect(parseMultiplier("0.9")).toBeNull();
  });
});

describe("parsePageCount", () => {
  it("accepts even counts up to the proof cap", () => {
    expect(parsePageCount(4)).toBe(4);
    expect(parsePageCount(24)).toBe(24);
  });

  it("accepts a single side, for a board", () => {
    expect(parsePageCount(1)).toBe(1);
  });

  it("rejects odd, zero and oversized counts", () => {
    expect(parsePageCount(3)).toBeNull();
    expect(parsePageCount(0)).toBeNull();
    expect(parsePageCount(26)).toBeNull();
  });
});

describe("pageCountFormatError", () => {
  it("holds a board to one side and a card or bookmark to two", () => {
    expect(pageCountFormatError(1, 1)).toBeNull();
    expect(pageCountFormatError(2, 1)).not.toBeNull();
    expect(pageCountFormatError(2, 2)).toBeNull();
    expect(pageCountFormatError(4, 2)).not.toBeNull();
    expect(pageCountFormatError(1, 2)).not.toBeNull();
  });

  it("refuses a booklet without room for a cover, inside and back", () => {
    expect(pageCountFormatError(4, 3)).toBeNull();
    expect(pageCountFormatError(24, 3)).toBeNull();
    expect(pageCountFormatError(1, 3)).not.toBeNull();
    expect(pageCountFormatError(2, 3)).not.toBeNull();
  });
});

describe("formatSizesError", () => {
  const a5Booklet = { trimWidthMm: 148, trimHeightMm: 210, sizedByOption: false };
  const sizes = [
    { label: "A6", widthMm: 105, heightMm: 148 },
    { label: "A4", widthMm: 210, heightMm: 297 },
  ];

  it("allows any format change while no size is switched on", () => {
    expect(formatSizesError({ ...a5Booklet, sizedByOption: true }, [])).toBeNull();
    expect(formatSizesError({ ...a5Booklet, trimWidthMm: 210 }, [])).toBeNull();
  });

  it("allows a trim of the same shape", () => {
    expect(formatSizesError({ ...a5Booklet, trimWidthMm: 210, trimHeightMm: 297 }, sizes)).toBeNull();
  });

  it("refuses turning page options into sizes while print sizes are on", () => {
    expect(formatSizesError({ ...a5Booklet, sizedByOption: true }, sizes)).toMatch(/Switch off this product's print sizes/);
  });

  it("names the size a new trim's shape doesn't fit", () => {
    expect(formatSizesError({ ...a5Booklet, trimWidthMm: 210, trimHeightMm: 210 }, sizes)).toMatch(/Switch off the A6 print size/);
  });
});

describe("sizeFormatError", () => {
  const a5Booklet = { trimWidthMm: 148, trimHeightMm: 210, sizedByOption: false };

  it("takes every A size for an A5 product, rounded millimetres and all", () => {
    expect(sizeFormatError(a5Booklet, 105, 148)).toBeNull();
    expect(sizeFormatError(a5Booklet, 148, 210)).toBeNull();
    expect(sizeFormatError(a5Booklet, 210, 297)).toBeNull();
    expect(sizeFormatError(a5Booklet, 841, 1189)).toBeNull();
  });

  it("refuses another shape, or the A shape turned round", () => {
    expect(sizeFormatError(a5Booklet, 210, 210)).toMatch(/own shape/);
    expect(sizeFormatError(a5Booklet, 297, 210)).toMatch(/own shape/);
    expect(sizeFormatError(a5Booklet, 216, 279)).toMatch(/own shape/);
  });

  it("scales a square product only to squares", () => {
    const square = { trimWidthMm: 210, trimHeightMm: 210, sizedByOption: false };
    expect(sizeFormatError(square, 250, 250)).toBeNull();
    expect(sizeFormatError(square, 148, 210)).toMatch(/own shape/);
  });

  it("refuses sizes on a board, whose page options are its sizes", () => {
    expect(sizeFormatError({ trimWidthMm: 210, trimHeightMm: 297, sizedByOption: true }, 420, 594)).toMatch(
      /already its print sizes/,
    );
  });
});

describe("parseHexColour", () => {
  it("normalises #rrggbb to lowercase", () => {
    expect(parseHexColour("#6B2D6A")).toBe("#6b2d6a");
  });

  it("rejects shorthand and non-hex", () => {
    expect(parseHexColour("#fff")).toBeNull();
    expect(parseHexColour("6b2d6a")).toBeNull();
    expect(parseHexColour("#gggggg")).toBeNull();
  });
});

describe("parseOptionInput", () => {
  it("requires a multiplier for multiplier-kind options", () => {
    const missing = parseOptionInput("paper", { slug: "silk", label: "Silk" });
    expect(missing.ok).toBe(false);

    const parsed = parseOptionInput("paper", {
      slug: "silk",
      label: "Silk",
      multiplier: 1.05,
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        slug: "silk",
        label: "Silk",
        note: null,
        sortOrder: 0,
        multiplier: "1.0500",
      },
    });
  });

  it("requires a multiplier and both edges for size options", () => {
    expect(parseOptionInput("size", { slug: "a4", label: "A4", multiplier: 1.6, widthMm: 210 }).ok).toBe(false);
    expect(parseOptionInput("size", { slug: "a4", label: "A4", widthMm: 210, heightMm: 297 }).ok).toBe(false);
    expect(parseOptionInput("size", { slug: "a4", label: "A4", multiplier: 1.6, widthMm: 210.5, heightMm: 297 }).ok).toBe(
      false,
    );
    expect(parseOptionInput("size", { slug: "a4", label: "A4", multiplier: 1.6, widthMm: 210, heightMm: 297 })).toEqual({
      ok: true,
      value: { slug: "a4", label: "A4", note: null, sortOrder: 0, multiplier: "1.6000", widthMm: 210, heightMm: 297 },
    });
  });

  it("requires copies for quantity options", () => {
    const missing = parseOptionInput("quantity", {
      slug: "50",
      label: "50",
      multiplier: 0.9,
    });
    expect(missing.ok).toBe(false);

    const parsed = parseOptionInput("quantity", {
      slug: "50",
      label: "50",
      multiplier: 0.9,
      copies: 50,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.copies).toBe(50);
  });

  it("requires pageCount and baseRatePence for page-count options", () => {
    const parsed = parseOptionInput("page-count", {
      slug: "4",
      label: "4 page",
      pageCount: 4,
      baseRatePence: 220,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.pageCount).toBe(4);
      expect(parsed.value.baseRatePence).toBe(220);
    }
  });

  it("requires a note and pricePence for delivery options", () => {
    const noNote = parseOptionInput("delivery", {
      slug: "next-day",
      label: "Next day",
      pricePence: 1000,
    });
    expect(noNote.ok).toBe(false);

    const parsed = parseOptionInput("delivery", {
      slug: "next-day",
      label: "Next day",
      pricePence: 1000,
      note: "Order by {cutoff}",
    });
    expect(parsed.ok).toBe(true);
  });

  // A typed time is how the delivery section came to say 11am while every
  // other page said 10am.
  it("refuses a delivery note that types the cut-off instead of {cutoff}", () => {
    const parsed = parseOptionInput("delivery", {
      slug: "next-day",
      label: "Next day",
      pricePence: 1000,
      note: "Order before 11am for next working day",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("{cutoff}");
  });
});

describe("optionNoteError", () => {
  it("accepts {cutoff} in a delivery note, and no note at all", () => {
    expect(optionNoteError("delivery", "Order by {cutoff} on a working day")).toBeNull();
    expect(optionNoteError("paper", null)).toBeNull();
  });

  it("refuses a clock time in a delivery note, but not in a paper note", () => {
    expect(optionNoteError("delivery", "By 10:30am")).not.toBeNull();
    expect(optionNoteError("delivery", "Order before 2 pm")).not.toBeNull();
    expect(optionNoteError("paper", "Dries by 11am")).toBeNull();
  });

  it("refuses a misspelt token, which customers would see as braces", () => {
    expect(optionNoteError("delivery", "Order by {Cutoff}")).toContain("Unknown {Cutoff}");
    expect(optionNoteError("delivery", "Order by {cut-off}")).not.toBeNull();
  });

  it("refuses {cutoff} outside a delivery note, where nothing fills it in", () => {
    expect(optionNoteError("paper", "Next day if ordered by {cutoff}")).not.toBeNull();
  });
});

describe("parseOptionPatch", () => {
  it("checks an edited note like a new one", () => {
    expect(parseOptionPatch("delivery", { note: "Order before 11am" }).ok).toBe(false);
    expect(parseOptionPatch("delivery", { note: "Order by {cutoff}" }).ok).toBe(true);
  });

  it("accepts a partial edit", () => {
    const parsed = parseOptionPatch("page-count", { baseRatePence: 250 });
    expect(parsed).toEqual({ ok: true, value: { baseRatePence: 250 } });
  });

  it("rejects fields that don't belong to the kind", () => {
    expect(parseOptionPatch("paper", { pricePence: 100 }).ok).toBe(false);
    expect(parseOptionPatch("delivery", { multiplier: 1 }).ok).toBe(false);
    expect(parseOptionPatch("paper", { widthMm: 210 }).ok).toBe(false);
  });

  it("edits a size's multiplier or one edge", () => {
    expect(parseOptionPatch("size", { multiplier: 1.6, heightMm: 297 })).toEqual({
      ok: true,
      value: { multiplier: "1.6000", heightMm: 297 },
    });
    expect(parseOptionPatch("size", { widthMm: 0 }).ok).toBe(false);
  });

  it("refuses to null a delivery note", () => {
    expect(parseOptionPatch("delivery", { note: null }).ok).toBe(false);
    expect(parseOptionPatch("paper", { note: null })).toEqual({
      ok: true,
      value: { note: null },
    });
  });
});

describe("parseLayoutPages", () => {
  const page = { id: "page-1", elements: [] };
  const triple = [page, { id: "page-2", elements: [] }, { id: "page-3", elements: [] }];

  it("accepts null (clear) and a cover/middle/back triple", () => {
    expect(parseLayoutPages(null)).toEqual({ ok: true, pages: null });
    expect(parseLayoutPages(triple)).toEqual({ ok: true, pages: triple });
  });

  it("rejects any length other than the three-page structure", () => {
    expect(parseLayoutPages([]).ok).toBe(false);
    expect(parseLayoutPages([page]).ok).toBe(false);
    expect(parseLayoutPages([page, page]).ok).toBe(false);
    expect(parseLayoutPages(Array.from({ length: 4 }, () => page)).ok).toBe(false);
  });

  it("rejects malformed pages and non-arrays", () => {
    expect(parseLayoutPages([{ id: 1, elements: [] }, page, page]).ok).toBe(false);
    expect(parseLayoutPages([{ id: "p", elements: "nope" }, page, page]).ok).toBe(false);
    expect(parseLayoutPages("pages").ok).toBe(false);
  });
});

describe("parseLayoutAction", () => {
  it("accepts the three layout actions", () => {
    expect(parseLayoutAction("publish")).toBe("publish");
    expect(parseLayoutAction("discard")).toBe("discard");
    expect(parseLayoutAction("clear")).toBe("clear");
  });

  it("rejects anything else", () => {
    expect(parseLayoutAction("save")).toBeNull();
    expect(parseLayoutAction("")).toBeNull();
    expect(parseLayoutAction(undefined)).toBeNull();
    expect(parseLayoutAction({ action: "publish" })).toBeNull();
  });
});

describe("parseProductDescription", () => {
  it("trims, and turns an empty blurb into null", () => {
    expect(parseProductDescription("  A small keepsake.  ")).toBe("A small keepsake.");
    expect(parseProductDescription("   ")).toBeNull();
    expect(parseProductDescription(null)).toBeNull();
  });

  it("rejects non-strings and anything longer than the column", () => {
    expect(parseProductDescription(42)).toBeUndefined();
    expect(parseProductDescription("a".repeat(301))).toBeUndefined();
    expect(parseProductDescription("a".repeat(300))).toHaveLength(300);
  });
});

describe("parseProductOccasion", () => {
  it("accepts only the two shop groups", () => {
    expect(parseProductOccasion("service")).toBe("service");
    expect(parseProductOccasion("after")).toBe("after");
    expect(parseProductOccasion("other")).toBeNull();
    expect(parseProductOccasion(undefined)).toBeNull();
  });
});

describe("parseVatTreatment", () => {
  it("accepts only the four VAT treatments", () => {
    for (const value of ["standard", "reduced", "zero", "exempt"]) expect(parseVatTreatment(value)).toBe(value);
    expect(parseVatTreatment("20%")).toBeNull();
    expect(parseVatTreatment("none")).toBeNull();
    expect(parseVatTreatment(undefined)).toBeNull();
  });
});

describe("parseSlugOrder", () => {
  it("accepts distinct slugs in the order given", () => {
    expect(parseSlugOrder(["order-of-service", "bookmark"])).toEqual(["order-of-service", "bookmark"]);
  });

  it("refuses an empty list, a repeat, a bad slug or a non-list", () => {
    expect(parseSlugOrder([])).toBeNull();
    expect(parseSlugOrder(["bookmark", "bookmark"])).toBeNull();
    expect(parseSlugOrder(["bookmark", "Not A Slug"])).toBeNull();
    expect(parseSlugOrder(["bookmark", 3])).toBeNull();
    expect(parseSlugOrder("bookmark")).toBeNull();
  });
});
