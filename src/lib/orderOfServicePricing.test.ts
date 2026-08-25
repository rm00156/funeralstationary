import { describe, expect, it } from "vitest";
import {
  defaultSelection,
  formatPence,
  getQuote,
  type PricingData,
} from "@/lib/orderOfServicePricing";

/** Mirrors the seeded order-of-service rates (src/db/seedCatalogue.ts). */
const PRICING: PricingData = {
  quantity: [
    { id: "15", label: "15", value: 15, multiplier: 1 },
    { id: "100", label: "100", value: 100, multiplier: 0.84 },
  ],
  size: [{ id: "a5", label: "A5", multiplier: 1 }],
  colour: [
    { id: "full-colour-both", label: "Full-colour both sides", multiplier: 1 },
    { id: "mono", label: "Black & white", multiplier: 0.7 },
  ],
  pages: [
    { id: "4", label: "4 page", pages: 4, baseRatePence: 220 },
    { id: "8", label: "8 page", pages: 8, baseRatePence: 300 },
  ],
  paper: [
    { id: "silk", label: "Silk", multiplier: 1 },
    { id: "premium-silk", label: "Premium Silk", multiplier: 1.2 },
  ],
  delivery: [
    { id: "standard", label: "Standard delivery", pricePence: 0, note: "Free" },
    { id: "next-day", label: "Next day delivery", pricePence: 1000, note: "By 11am" },
  ],
};

describe("defaultSelection", () => {
  it("picks the first option on every axis", () => {
    expect(defaultSelection(PRICING)).toEqual({
      quantity: "15",
      size: "a5",
      colour: "full-colour-both",
      pages: "4",
      paper: "silk",
      delivery: "standard",
    });
  });
});

describe("getQuote", () => {
  it("computes total as printCost plus delivery for the default selection", () => {
    const quote = getQuote(PRICING, defaultSelection(PRICING));
    expect(quote.unitPricePence).toBe(220);
    expect(quote.printCostPence).toBe(3300);
    expect(quote.totalPence).toBe(3300);
  });

  it("applies the quantity-break multiplier to the unit price", () => {
    const base = getQuote(PRICING, defaultSelection(PRICING));
    const bulk = getQuote(PRICING, { ...defaultSelection(PRICING), quantity: "100" });
    expect(bulk.unitPricePence).toBeLessThan(base.unitPricePence);
  });

  it("adds delivery price on top of print cost", () => {
    const quote = getQuote(PRICING, {
      ...defaultSelection(PRICING),
      delivery: "next-day",
    });
    expect(quote.totalPence).toBe(quote.printCostPence + 1000);
  });

  it("rounds the multiplied unit price to whole pence", () => {
    // 220 x 0.7 x 1.2 = 184.8 -> 185
    const quote = getQuote(PRICING, {
      ...defaultSelection(PRICING),
      colour: "mono",
      paper: "premium-silk",
    });
    expect(quote.unitPricePence).toBe(185);
    expect(quote.printCostPence).toBe(185 * 15);
  });

  it("falls back to the first option for an unknown selection id", () => {
    const quote = getQuote(PRICING, {
      ...defaultSelection(PRICING),
      paper: "not-a-real-id",
    });
    expect(quote.paper.id).toBe("silk");
  });
});

describe("formatPence", () => {
  it("formats pence as GBP currency", () => {
    expect(formatPence(3299)).toBe("£32.99");
  });
});
