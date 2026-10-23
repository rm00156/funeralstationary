import { describe, expect, it } from "vitest";

import type { AdminOption, OptionKind } from "@/lib/adminCatalogue.server";
import {
  changedKeys,
  changeSummary,
  editsPatch,
  moveItem,
  newOptionPayload,
  previewPricingData,
  pricingSections,
  pruneEdits,
  savedValue,
} from "@/lib/adminPricing";
import { getQuote } from "@/lib/orderOfServicePricing";

const option = (slug: string, extra: Partial<AdminOption> = {}): AdminOption => ({
  slug,
  label: slug,
  note: null,
  sortOrder: 0,
  isActive: true,
  ...extra,
});

const QTY_25 = option("25", { multiplier: 0.95, copies: 25 });
const PAGES_8 = option("8", { label: "8 page", pageCount: 8, baseRatePence: 402 });
const STANDARD = option("standard", { label: "Standard", pricePence: 0, note: "Free" });

describe("edits", () => {
  it("counts a typed value as changed only when it means something different", () => {
    expect(changedKeys(QTY_25, { multiplier: "0.950", copies: "25" })).toEqual([]);
    expect(changedKeys(QTY_25, { multiplier: "0.85" })).toEqual(["multiplier"]);
    expect(changedKeys(PAGES_8, { baseRatePence: "4.02" })).toEqual([]);
    expect(changedKeys(PAGES_8, { baseRatePence: "4.2" })).toEqual(["baseRatePence"]);
    expect(changedKeys(PAGES_8, { label: " 8 page " })).toEqual([]);
    // A value that doesn't parse is a change, so it can't be quietly dropped.
    expect(changedKeys(QTY_25, { copies: "lots" })).toEqual(["copies"]);
  });

  it("shows a price in pounds and a missing note as blank", () => {
    expect(savedValue(PAGES_8, "baseRatePence")).toBe("4.02");
    expect(savedValue(QTY_25, "note")).toBe("");
  });

  it("drops edits a save has caught up with and keeps the rest", () => {
    const saved = [{ ...QTY_25, multiplier: 0.85 }, option("50", { multiplier: 0.8, copies: 50 })];
    expect(
      pruneEdits(saved, { "25": { multiplier: "0.85" }, "50": { multiplier: "0.7", copies: "50" } }),
    ).toEqual({ "50": { multiplier: "0.7" } });
  });
});

describe("changeSummary", () => {
  it("names the one option changed, by its copies for a quantity", () => {
    expect(changeSummary("quantity", [QTY_25], { "25": { multiplier: "0.85" } })).toEqual({
      count: "1 unsaved change",
      detail: "25 copies, multiplier 0.95 → 0.85",
    });
    expect(changeSummary("page-count", [PAGES_8], { "8": { baseRatePence: "4.50", note: "Most popular" } })).toEqual({
      count: "2 unsaved changes",
      detail: "8 page, base rate 4.02 → 4.50, note blank → Most popular",
    });
  });

  it("counts across options, and is null with nothing changed", () => {
    const fifty = option("50", { multiplier: 0.8, copies: 50 });
    expect(
      changeSummary("quantity", [QTY_25, fifty], { "25": { multiplier: "0.85" }, "50": { copies: "60" } }),
    ).toEqual({ count: "2 unsaved changes", detail: "across 2 options" });
    expect(changeSummary("quantity", [QTY_25], { "25": { multiplier: "0.95" } })).toBeNull();
  });
});

describe("editsPatch", () => {
  it("sends only the changed columns, prices in pence and a cleared note as null", () => {
    const withNote = { ...PAGES_8, note: "Popular" };
    expect(editsPatch("page-count", withNote, { baseRatePence: "4.50", note: " ", pageCount: "8" })).toEqual({
      ok: true,
      payload: { baseRatePence: 450, note: null },
    });
  });

  it("refuses a value that doesn't parse rather than rounding it", () => {
    expect(editsPatch("page-count", PAGES_8, { baseRatePence: "4.505" })).toEqual({
      ok: false,
      error: "Base rate (£) must be a price like 2.20",
    });
    expect(editsPatch("quantity", QTY_25, { copies: "" })).toEqual({ ok: false, error: "Copies must be a number" });
    expect(editsPatch("quantity", QTY_25, { label: "  " })).toEqual({
      ok: false,
      error: "The label can't be blank",
    });
  });

  it("builds a new option's fields, refusing a blank one", () => {
    expect(newOptionPayload("delivery", { pricePence: "4.95" })).toEqual({ ok: true, payload: { pricePence: 495 } });
    expect(newOptionPayload("quantity", { multiplier: "0.9" })).toEqual({
      ok: false,
      error: "Copies must be a number",
    });
  });
});

describe("previewPricingData", () => {
  const options: Record<OptionKind, AdminOption[]> = {
    quantity: [QTY_25, option("10", { multiplier: 1, copies: 10, isActive: false })],
    "page-count": [PAGES_8],
    paper: [option("silk", { label: "Silk", multiplier: 1 })],
    delivery: [STANDARD],
    size: [],
  };

  it("prices active options with the unsaved edits applied", () => {
    const noEdits = { quantity: {}, "page-count": {}, paper: {}, delivery: {}, size: {} };
    const data = previewPricingData(options, { ...noEdits, quantity: { "25": { multiplier: "0.5" } } });
    expect(data.quantity.map((entry) => entry.id)).toEqual(["25"]);
    const quote = getQuote(data, { quantity: "25", pages: "8", paper: "silk", delivery: "standard", size: "" });
    expect(quote.unitPricePence).toBe(201);
    expect(quote.totalPence).toBe(201 * 25);
  });

  it("keeps the saved value where an edit doesn't parse", () => {
    const noEdits = { quantity: {}, "page-count": {}, paper: {}, delivery: {}, size: {} };
    const data = previewPricingData(options, { ...noEdits, "page-count": { "8": { baseRatePence: "abc" } } });
    expect(data.pages[0].baseRatePence).toBe(402);
  });
});

describe("pricingSections", () => {
  it("lists the booklet's tables in the buy box's order", () => {
    expect(pricingSections({ sizedByOption: false, paperLabel: "Paper" }).map((section) => section.title)).toEqual([
      "Quantities",
      "Page counts",
      "Print sizes",
      "Paper stocks",
      "Delivery",
    ]);
  });

  it("gives a board its sizes as page counts, no print sizes, and its own paper name", () => {
    const sections = pricingSections({ sizedByOption: true, paperLabel: "Finish" });
    expect(sections.map((section) => section.title)).toEqual(["Quantities", "Sizes", "Finish options", "Delivery"]);
    expect(sections.find((section) => section.kind === "paper")?.singular).toBe("finish");
  });
});

describe("moveItem", () => {
  it("moves an item and clamps the target", () => {
    expect(moveItem(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], "a", 9)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], "z", 0)).toEqual(["a", "b"]);
  });
});
