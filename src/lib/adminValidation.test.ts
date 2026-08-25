import { describe, expect, it } from "vitest";
import {
  parseHexColour,
  parseLayoutPages,
  parseMultiplier,
  parseOptionInput,
  parseOptionPatch,
  parsePageCount,
  parsePence,
  parseSlug,
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

  it("rejects odd, zero and oversized counts", () => {
    expect(parsePageCount(3)).toBeNull();
    expect(parsePageCount(0)).toBeNull();
    expect(parsePageCount(26)).toBeNull();
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
      note: "Order before 11am",
    });
    expect(parsed.ok).toBe(true);
  });
});

describe("parseOptionPatch", () => {
  it("accepts a partial edit", () => {
    const parsed = parseOptionPatch("page-count", { baseRatePence: 250 });
    expect(parsed).toEqual({ ok: true, value: { baseRatePence: 250 } });
  });

  it("rejects fields that don't belong to the kind", () => {
    expect(parseOptionPatch("paper", { pricePence: 100 }).ok).toBe(false);
    expect(parseOptionPatch("delivery", { multiplier: 1 }).ok).toBe(false);
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

  it("accepts null (clear) and well-formed page arrays", () => {
    expect(parseLayoutPages(null)).toEqual({ ok: true, pages: null });
    expect(parseLayoutPages([page])).toEqual({ ok: true, pages: [page] });
  });

  it("rejects empty, oversized and malformed arrays", () => {
    expect(parseLayoutPages([]).ok).toBe(false);
    expect(parseLayoutPages(Array.from({ length: 25 }, () => page)).ok).toBe(false);
    expect(parseLayoutPages([{ id: 1, elements: [] }]).ok).toBe(false);
    expect(parseLayoutPages([{ id: "p", elements: "nope" }]).ok).toBe(false);
    expect(parseLayoutPages("pages").ok).toBe(false);
  });
});
