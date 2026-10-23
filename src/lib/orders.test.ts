import { describe, expect, it } from "vitest";

import {
  ORDER_NUMBER_RE,
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  buildStripeLineItems,
  canTransition,
  computeOrderTotals,
  lineSpec,
  staleLineSpec,
  makeOrderNumber,
  parseOrderStatus,
  pressScaleNote,
  refundStatusEffect,
  earliestServiceDate,
  lineEditOutcome,
  lineSizeSlug,
  refundedPence,
  resolveSelectionStrict,
  sumLineItems,
  vatFromInclusive,
  vatRateToDecimalString,
} from "@/lib/orders";
import type { PricingData } from "@/lib/orderOfServicePricing";
import type { VatTreatment } from "@/lib/vat";

const line = (printPence: number, deliveryPence: number, vatTreatment: VatTreatment = "standard") => ({
  printPence,
  deliveryPence,
  vatTreatment,
});

const pricing: PricingData = {
  quantity: [
    { id: "q15", label: "15", multiplier: 1, value: 15 },
    { id: "q50", label: "50", multiplier: 0.9, value: 50 },
  ],
  pages: [{ id: "p8", label: "8 pages", pages: 8, baseRatePence: 200 }],
  paper: [{ id: "silk", label: "Silk", multiplier: 1 }],
  delivery: [{ id: "standard", label: "Standard", pricePence: 0, note: "" }],
  size: [],
};

const A5 = { id: "a5", label: "A5", multiplier: 1, widthMm: 148, heightMm: 210 };
const A4 = { id: "a4", label: "A4", multiplier: 1.5, widthMm: 210, heightMm: 297 };
const sized: PricingData = { ...pricing, size: [A5, A4] };

describe("status machine", () => {
  it("allows the documented forward path", () => {
    expect(canTransition("awaiting_print", "in_production")).toBe(true);
    expect(canTransition("in_production", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("rejects skipping steps and leaving terminal states", () => {
    expect(canTransition("awaiting_print", "delivered")).toBe(false);
    expect(canTransition("refunded", "draft")).toBe(false);
    expect(canTransition("draft", "awaiting_print")).toBe(false); // only payment does this
  });

  it("has no customer proof-approval detour", () => {
    // Mistakes are caught before payment by the pre-order check, so a paid
    // order goes straight to the print queue — see designReadiness.ts.
    expect(ORDER_STATUSES).not.toContain("awaiting_proof");
    expect(ORDER_STATUSES).not.toContain("proof_sent");
    expect(ORDER_STATUSES).not.toContain("approved");
    expect(ORDER_STATUS_TRANSITIONS.awaiting_print).toEqual(["in_production", "cancelled"]);
  });

  it("covers every status exactly once and only points at real statuses", () => {
    expect(Object.keys(ORDER_STATUS_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
    for (const targets of Object.values(ORDER_STATUS_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target);
    }
  });

  it("parses statuses strictly", () => {
    expect(parseOrderStatus("shipped")).toBe("shipped");
    expect(parseOrderStatus("SHIPPED")).toBeNull();
    expect(parseOrderStatus(3)).toBeNull();
  });
});

describe("VAT and totals", () => {
  it("backs VAT out of an inclusive amount", () => {
    expect(vatFromInclusive(12000)).toBe(2000);
    expect(vatFromInclusive(10000)).toBe(1667);
    expect(vatFromInclusive(0)).toBe(0);
    expect(vatFromInclusive(10000, 0)).toBe(0);
  });

  it("formats the rate the way the decimal column expects", () => {
    expect(vatRateToDecimalString(0.2)).toBe("0.2000");
    expect(vatRateToDecimalString(0.05)).toBe("0.0500");
  });

  it("sums lines, adds delivery and backs out VAT of the total", () => {
    expect(computeOrderTotals([line(3000, 499), line(1500, 0)])).toEqual({
      subtotalPence: 4500,
      deliveryPence: 499,
      totalPence: 4999,
      vatPence: vatFromInclusive(4999),
      vatRate: 0.2,
    });
    expect(computeOrderTotals([]).totalPence).toBe(0);
  });

  it("backs VAT out at each product's treatment, its delivery with it", () => {
    const totals = computeOrderTotals([line(6000, 499, "zero"), line(3000, 999, "standard"), line(2100, 0, "reduced")]);
    expect(totals.totalPence).toBe(12_598);
    expect(totals.vatPence).toBe(vatFromInclusive(3999) + vatFromInclusive(2100, 0.05));
    expect(totals.vatRate).toBe(Number((totals.vatPence / (12_598 - totals.vatPence)).toFixed(4)));
  });

  it("charges no VAT on zero-rated and exempt products, and records their one rate", () => {
    const totals = computeOrderTotals([line(6000, 499, "zero"), line(1000, 0, "exempt")]);
    expect(totals.vatPence).toBe(0);
    expect(computeOrderTotals([line(6000, 499, "reduced")]).vatRate).toBe(0.05);
    expect(computeOrderTotals([line(6000, 499, "zero")]).vatRate).toBe(0);
  });
});

describe("resolveSelectionStrict", () => {
  const selection = {
    quantity: "q50",
    pages: "p8",
    paper: "silk",
    delivery: "standard",
    size: "",
  };

  it("prices a fully valid selection", () => {
    const result = resolveSelectionStrict(pricing, selection);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.unitPricePence).toBe(180);
      expect(result.quote.printCostPence).toBe(9000);
    }
  });

  it("names every unknown axis instead of silently falling back", () => {
    const result = resolveSelectionStrict(pricing, {
      ...selection,
      quantity: "q999",
      paper: "gone",
    });
    expect(result).toEqual({ ok: false, invalid: ["quantity", "paper"] });
  });

  it("accepts no size for a product that has none, and refuses one it doesn't sell", () => {
    expect(resolveSelectionStrict(pricing, selection).ok).toBe(true);
    expect(resolveSelectionStrict(pricing, { ...selection, size: "a4" })).toEqual({ ok: false, invalid: ["size"] });
  });

  it("prices a chosen size, and calls a missing one stale once the product has sizes", () => {
    const result = resolveSelectionStrict(sized, { ...selection, size: "a4" });
    expect(result.ok && result.quote.unitPricePence).toBe(270); // 200 × 1.5 × 0.9
    expect(resolveSelectionStrict(sized, selection)).toEqual({ ok: false, invalid: ["size"] });
    expect(resolveSelectionStrict(sized, { ...selection, size: "a3" })).toEqual({ ok: false, invalid: ["size"] });
  });
});

describe("lineSizeSlug", () => {
  const trim = { widthMm: 148, heightMm: 210 };
  const A6 = { id: "a6", label: "A6", multiplier: 0.8, widthMm: 105, heightMm: 148 };

  it("keeps a size that is still offered", () => {
    expect(lineSizeSlug(sized, "a4", A4, trim)).toBe("a4");
  });

  it("reads a line from before the product had sizes as its trim's size", () => {
    expect(lineSizeSlug(sized, "", null, trim)).toBe("a5");
    // No size at the trim on offer: still stale, nothing guessed.
    expect(lineSizeSlug({ ...pricing, size: [A6, A4] }, "", null, trim)).toBe("");
  });

  it("reads a line at the trim's size as no size once sizes are switched off", () => {
    expect(lineSizeSlug(pricing, "a5", A5, trim)).toBe("");
    expect(resolveSelectionStrict(pricing, {
      quantity: "q15", pages: "p8", paper: "silk", delivery: "standard",
      size: lineSizeSlug(pricing, "a5", A5, trim),
    }).ok).toBe(true);
  });

  it("never turns another size into the trim's", () => {
    expect(lineSizeSlug(pricing, "a4", A4, trim)).toBe("a4");
    expect(lineSizeSlug({ ...pricing, size: [A5] }, "a4", A4, trim)).toBe("a4");
    // Dimensions unknown (quoted before sizes were snapshotted): left alone.
    expect(lineSizeSlug(pricing, "a5", null, trim)).toBe("a5");
  });

  it("follows a size to a re-made option at the same dimensions", () => {
    const a5New = { ...A5, id: "a5-new" };
    expect(lineSizeSlug({ ...pricing, size: [a5New] }, "a5", A5, trim)).toBe("a5-new");
  });
});

describe("lineEditOutcome", () => {
  const selection = { quantity: "q50", pages: "p8", paper: "silk", delivery: "standard", size: "" };

  it("prices an edit when every choice prices", () => {
    expect(lineEditOutcome(pricing, selection, ["quantity"]).kind).toBe("price");
  });

  it("refuses a choice the customer sent that doesn't price", () => {
    expect(lineEditOutcome(pricing, { ...selection, quantity: "q999" }, ["quantity"])).toEqual({
      kind: "refuse",
      axis: "quantity",
    });
  });

  it("saves a good choice on a line stale on two, so each can be fixed in turn", () => {
    const twoStale = { ...selection, quantity: "q25", delivery: "gone" };
    expect(lineEditOutcome(pricing, { ...twoStale, quantity: "q50" }, ["quantity"])).toEqual({ kind: "save" });
    expect(lineEditOutcome(pricing, { ...twoStale, delivery: "standard" }, ["delivery"])).toEqual({ kind: "save" });
  });
});

describe("makeOrderNumber", () => {
  it("is TFS-<year>-<6 digits>, zero padded", () => {
    expect(makeOrderNumber(2026, () => 0)).toBe("TFS-2026-000000");
    expect(makeOrderNumber(2026, () => 0.999999)).toBe("TFS-2026-999999");
    expect(makeOrderNumber(2026, () => 0.0421)).toBe("TFS-2026-042100");
    expect(makeOrderNumber(2026)).toMatch(ORDER_NUMBER_RE);
  });
});

describe("buildStripeLineItems", () => {
  const nextDay = { label: "Next day", pricePence: 999 };
  const standard = { label: "Standard", pricePence: 0 };

  it("sums to the order total, per-line delivery included", () => {
    const lines = buildStripeLineItems([
      { name: "Order of service — Whispering Petals", unitPricePence: 180, copies: 50, delivery: nextDay },
      { name: "Memorial cards — Second", unitPricePence: 250, copies: 15, delivery: nextDay },
    ]);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toEqual({
      name: "Delivery — Next day (Order of service — Whispering Petals)",
      unitAmountPence: 999,
      quantity: 1,
    });
    expect(sumLineItems(lines)).toBe(computeOrderTotals([line(9000, 999), line(3750, 999)]).totalPence);
  });

  it("omits a free delivery line but keeps a paid one on the same order", () => {
    const lines = buildStripeLineItems([
      { name: "First", unitPricePence: 180, copies: 50, delivery: standard },
      { name: "Second", unitPricePence: 250, copies: 15, delivery: nextDay },
    ]);
    expect(lines.map((line) => line.name)).toEqual(["First", "Second", "Delivery — Next day (Second)"]);
    expect(sumLineItems(lines)).toBe(12750 + 999);
  });
});

describe("lineSpec", () => {
  const quote = { pages: { label: "8 page" }, paper: { label: "Silk" } };

  it("leads with the product's size", () => {
    expect(lineSpec({ sizeLabel: "A5", sizedByOption: false }, quote)).toBe("A5 · 8 page · Silk");
  });

  it("lets a board's size option speak for itself", () => {
    expect(
      lineSpec(
        { sizeLabel: "A4 to A0", sizedByOption: true },
        { pages: { label: "A1" }, paper: { label: "Mounted on 5mm board" } },
      ),
    ).toBe("A1 · Mounted on 5mm board");
  });

  it("leads with the print size chosen, when the product is sold in several", () => {
    expect(lineSpec({ sizeLabel: "A5", sizedByOption: false }, { ...quote, size: A4 })).toBe("A4 · 8 page · Silk");
    expect(lineSpec({ sizeLabel: "A5", sizedByOption: false }, { ...quote, size: null })).toBe("A5 · 8 page · Silk");
  });
});

describe("pressScaleNote", () => {
  const a5 = { widthMm: 148, heightMm: 210 };

  it("says nothing when the artwork is the size it prints at", () => {
    expect(pressScaleNote({ sizedByOption: false }, a5, { size: A5 })).toBeNull();
    expect(pressScaleNote({ sizedByOption: false }, a5, {})).toBeNull();
    expect(pressScaleNote({ sizedByOption: false }, a5, { size: null })).toBeNull();
  });

  it("tells the press the size to print an A5 design at", () => {
    expect(pressScaleNote({ sizedByOption: false }, a5, { size: A4 })).toBe(
      "Artwork drawn at 148 × 210 mm; print at A4 (210 × 297 mm), scaled 142%",
    );
    expect(
      pressScaleNote({ sizedByOption: false }, a5, { size: { label: "A6", widthMm: 105, heightMm: 148 } }),
    ).toBe("Artwork drawn at 148 × 210 mm; print at A6 (105 × 148 mm), scaled 71%");
  });

  it("keeps a board's note, whose page option is the size", () => {
    expect(pressScaleNote({ sizedByOption: true }, { widthMm: 210, heightMm: 297 }, {})).toBe(
      "Artwork drawn at 210 × 297 mm; scale to the size ordered",
    );
  });
});

describe("staleLineSpec", () => {
  it("counts pages for a printed product", () => {
    expect(staleLineSpec({ sizeLabel: "A5", sizedByOption: false }, 8)).toBe("A5 · 8 pages");
    expect(staleLineSpec({ sizeLabel: "A5", sizedByOption: false }, 1)).toBe("A5 · 1 page");
  });

  it("shows only the size range for a board, whose page option is a size", () => {
    expect(staleLineSpec({ sizeLabel: "A4 to A0", sizedByOption: true }, 1)).toBe("A4 to A0");
  });
});

describe("refunds", () => {
  it("counts only refunds that succeeded", () => {
    expect(
      refundedPence([
        { amountPence: 1000, status: "succeeded" },
        { amountPence: 500, status: "pending" },
        { amountPence: 700, status: "failed" },
        { amountPence: 300, status: "succeeded" },
      ]),
    ).toBe(1300);
    expect(refundedPence([])).toBe(0);
  });

  it("settles a fully refunded cancelled or delivered order to refunded", () => {
    expect(refundStatusEffect("cancelled", 5000, 5000)).toBe("refund");
    expect(refundStatusEffect("delivered", 5000, 5000)).toBe("refund");
    expect(canTransition("cancelled", "refunded")).toBe(true);
  });

  it("flags a fully refunded order that is still going to print, rather than stopping it", () => {
    expect(refundStatusEffect("awaiting_print", 5000, 5000)).toBe("still-printing");
    expect(refundStatusEffect("in_production", 5000, 5000)).toBe("still-printing");
  });

  it("leaves part refunds, shipped orders and settled ones alone", () => {
    expect(refundStatusEffect("cancelled", 4999, 5000)).toBe("none");
    expect(refundStatusEffect("shipped", 5000, 5000)).toBe("none");
    expect(refundStatusEffect("refunded", 5000, 5000)).toBe("none");
    expect(refundStatusEffect("draft", 0, 0)).toBe("none");
  });
});

describe("earliestServiceDate", () => {
  it("takes the earliest date given, ignoring lines without one", () => {
    expect(earliestServiceDate([null, "2026-10-12", "2026-10-09"])).toBe("2026-10-09");
    expect(earliestServiceDate([null, null])).toBeNull();
    expect(earliestServiceDate([])).toBeNull();
  });
});
