import { describe, expect, it } from "vitest";
import {
  cheapestQuote,
  defaultSelection,
  formatPence,
  getQuote,
  parseCarriedSelection,
  quoteSize,
  selectionSearchParams,
  sizesText,
  type PricingData,
  type Quote,
} from "@/lib/orderOfServicePricing";

/** Mirrors the seeded order-of-service rates (src/db/seedCatalogue.ts). */
const PRICING: PricingData = {
  quantity: [
    { id: "15", label: "15", value: 15, multiplier: 1 },
    { id: "100", label: "100", value: 100, multiplier: 0.84 },
  ],
  pages: [
    { id: "4", label: "4 page", pages: 4, baseRatePence: 220 },
    { id: "8", label: "8 page", pages: 8, baseRatePence: 300 },
  ],
  paper: [
    { id: "silk", label: "Silk", multiplier: 1 },
    { id: "premium-silk", label: "Premium Silk", multiplier: 1.2 },
    { id: "uncoated", label: "Uncoated", multiplier: 0.7 },
  ],
  delivery: [
    { id: "standard", label: "Standard delivery", pricePence: 0, note: "Free" },
    { id: "next-day", label: "Next day delivery", pricePence: 1000, note: "By {cutoff}" },
  ],
  size: [],
};

/** The booklet sold at A5 (the default), A6 and A4. */
const SIZED: PricingData = {
  ...PRICING,
  size: [
    { id: "a5", label: "A5", multiplier: 1, widthMm: 148, heightMm: 210 },
    { id: "a6", label: "A6", multiplier: 0.8, widthMm: 105, heightMm: 148 },
    { id: "a4", label: "A4", multiplier: 1.6, widthMm: 210, heightMm: 297 },
  ],
};

describe("defaultSelection", () => {
  it("picks the first option on every axis", () => {
    expect(defaultSelection(PRICING)).toEqual({
      quantity: "15",
      pages: "4",
      paper: "silk",
      delivery: "standard",
      size: "",
    });
  });

  it("starts on the first size when the product has sizes", () => {
    expect(defaultSelection(SIZED).size).toBe("a5");
  });
});

describe("print sizes", () => {
  const base = { quantity: "15", pages: "8", paper: "silk", delivery: "standard" };

  it("multiplies the per-copy price by the size's multiplier", () => {
    expect(getQuote(SIZED, { ...base, size: "a5" }).unitPricePence).toBe(300);
    expect(getQuote(SIZED, { ...base, size: "a4" }).unitPricePence).toBe(480);
    expect(getQuote(SIZED, { ...base, size: "a6" }).unitPricePence).toBe(240);
    expect(getQuote(SIZED, { ...base, size: "a4" }).size?.label).toBe("A4");
  });

  it("rounds once, after every multiplier", () => {
    const quote = getQuote(SIZED, { ...base, quantity: "100", paper: "premium-silk", size: "a4" });
    expect(quote.unitPricePence).toBe(Math.round(300 * 1.2 * 1.6 * 0.84));
  });

  it("prices a product without sizes at its trim, with no size on the quote", () => {
    const quote = getQuote(PRICING, { ...base, size: "" });
    expect(quote.unitPricePence).toBe(300);
    expect(quote.size).toBeNull();
    expect(quoteSize(quote)).toBeNull();
  });

  it("reads a quote frozen before sizes existed as having none", () => {
    const frozen: Quote = getQuote(SIZED, { ...base, size: "a5" });
    delete frozen.size;
    expect(quoteSize(frozen)).toBeNull();
  });

  it("quotes 'from' at the default size, where the price table and buy box start", () => {
    expect(cheapestQuote(SIZED)?.size?.id).toBe("a5"); // not the cheaper A6
  });

  it("carries a size through the URL and drops one the product doesn't sell", () => {
    expect(parseCarriedSelection(SIZED, { size: "a4" })).toEqual({ size: "a4" });
    expect(parseCarriedSelection(SIZED, { size: "a3" })).toEqual({});
    expect(parseCarriedSelection(PRICING, { size: "a4" })).toEqual({});
  });

  it("lists sizes smallest first", () => {
    expect(sizesText(SIZED.size)).toBe("A6, A5 or A4");
    expect(sizesText(SIZED.size.slice(0, 2))).toBe("A6 or A5");
    expect(sizesText(SIZED.size.slice(0, 1))).toBe("A5");
    expect(sizesText([])).toBe("");
  });
});

describe("carried selection", () => {
  it("round-trips through query params", () => {
    const selection = { quantity: "100", pages: "8", paper: "uncoated", delivery: "next-day" };
    const params = Object.fromEntries(selectionSearchParams(selection));
    expect(parseCarriedSelection(PRICING, params)).toEqual(selection);
  });

  it("drops slugs the product does not offer and ignores repeated params", () => {
    expect(
      parseCarriedSelection(PRICING, {
        quantity: "5000",
        pages: ["4", "8"],
        paper: "silk",
        delivery: undefined,
      }),
    ).toEqual({ paper: "silk" });
  });

  it("omits empty axes from the query string", () => {
    expect(selectionSearchParams({ pages: "8", paper: "" }).toString()).toBe("pages=8");
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
    // 220 x 0.84 = 184.8 -> 185
    const quote = getQuote(PRICING, {
      ...defaultSelection(PRICING),
      quantity: "100",
    });
    expect(quote.unitPricePence).toBe(185);
    expect(quote.printCostPence).toBe(185 * 100);
  });

  it("falls back to the first option for an unknown selection id", () => {
    const quote = getQuote(PRICING, {
      ...defaultSelection(PRICING),
      paper: "not-a-real-id",
    });
    expect(quote.paper.id).toBe("silk");
  });
});

describe("cheapestQuote", () => {
  it("picks the cheapest option on every axis regardless of sort order", () => {
    const quote = cheapestQuote(PRICING);
    expect(quote).not.toBeNull();
    // uncoated is listed last but is the cheapest paper; 4 page is the cheapest rate.
    expect(quote!.pages.id).toBe("4");
    expect(quote!.paper.id).toBe("uncoated");
    expect(quote!.delivery.id).toBe("standard");
    expect(quote!.totalPence).toBe(Math.round(220 * 0.7) * 15);
  });

  it("searches the quantity axis rather than taking the biggest break", () => {
    // 100 copies has the lower unit price but costs more in total than 15.
    expect(cheapestQuote(PRICING)!.quantity.id).toBe("15");
    const flat: PricingData = {
      ...PRICING,
      quantity: [
        { id: "50", label: "50", value: 50, multiplier: 1 },
        // A break so steep that 100 copies cost less than 50 in total.
        { id: "100", label: "100", value: 100, multiplier: 0.4 },
      ],
    };
    expect(cheapestQuote(flat)!.quantity.id).toBe("100");
  });

  it("is null when any axis has no options", () => {
    expect(cheapestQuote({ ...PRICING, paper: [] })).toBeNull();
    expect(cheapestQuote({ ...PRICING, quantity: [] })).toBeNull();
  });
});

describe("formatPence", () => {
  it("formats pence as GBP currency", () => {
    expect(formatPence(3299)).toBe("£32.99");
  });
});
