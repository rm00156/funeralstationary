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
  resolveSelectionStrict,
  sumLineItems,
  vatFromInclusive,
  vatRateToDecimalString,
} from "@/lib/orders";
import type { PricingData } from "@/lib/orderOfServicePricing";

const pricing: PricingData = {
  quantity: [
    { id: "q15", label: "15", multiplier: 1, value: 15 },
    { id: "q50", label: "50", multiplier: 0.9, value: 50 },
  ],
  pages: [{ id: "p8", label: "8 pages", pages: 8, baseRatePence: 200 }],
  paper: [{ id: "silk", label: "Silk", multiplier: 1 }],
  delivery: [{ id: "standard", label: "Standard", pricePence: 0, note: "" }],
};

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
    expect(computeOrderTotals([3000, 1500], 499)).toEqual({
      subtotalPence: 4500,
      deliveryPence: 499,
      totalPence: 4999,
      vatPence: vatFromInclusive(4999),
      vatRate: 0.2,
    });
    expect(computeOrderTotals([], 0).totalPence).toBe(0);
  });
});

describe("resolveSelectionStrict", () => {
  const selection = {
    quantity: "q50",
    pages: "p8",
    paper: "silk",
    delivery: "standard",
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
    expect(sumLineItems(lines)).toBe(computeOrderTotals([9000, 3750], 999 + 999).totalPence);
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
