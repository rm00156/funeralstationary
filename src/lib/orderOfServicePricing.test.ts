import { describe, expect, it } from "vitest";
import {
  DEFAULT_SELECTION,
  formatPrice,
  getQuote,
} from "@/lib/orderOfServicePricing";

describe("getQuote", () => {
  it("computes total as printCost plus delivery for the default selection", () => {
    const quote = getQuote(DEFAULT_SELECTION);
    expect(quote.unitPrice).toBe(2.2);
    expect(quote.printCost).toBe(33);
    expect(quote.total).toBe(33);
  });

  it("applies the quantity-break multiplier to the unit price", () => {
    const base = getQuote(DEFAULT_SELECTION);
    const bulk = getQuote({ ...DEFAULT_SELECTION, quantity: "100" });
    expect(bulk.unitPrice).toBeLessThan(base.unitPrice);
  });

  it("adds delivery price on top of print cost", () => {
    const quote = getQuote({ ...DEFAULT_SELECTION, delivery: "next-day" });
    expect(quote.total).toBe(roundPence(quote.printCost + 10));
  });

  it("falls back to the first option for an unknown selection id", () => {
    const quote = getQuote({ ...DEFAULT_SELECTION, paper: "not-a-real-id" });
    expect(quote.paper.id).toBe("silk");
  });
});

describe("formatPrice", () => {
  it("formats a number as GBP currency", () => {
    expect(formatPrice(32.99)).toBe("£32.99");
  });
});

function roundPence(value: number) {
  return Math.round(value * 100) / 100;
}
