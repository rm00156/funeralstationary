import { describe, expect, it } from "vitest";

import { chargesVat, isVatTreatment, priceVatNote, vatIncludedText, vatRateLabel } from "@/lib/vat";

describe("VAT treatments", () => {
  it("knows which treatments charge VAT", () => {
    expect(chargesVat("standard")).toBe(true);
    expect(chargesVat("reduced")).toBe(true);
    expect(chargesVat("zero")).toBe(false);
    expect(chargesVat("exempt")).toBe(false);
    expect(isVatTreatment("zero")).toBe(true);
    expect(isVatTreatment("none")).toBe(false);
  });

  it("says no VAT rather than VAT of £0.00", () => {
    expect(vatIncludedText(1667)).toBe("Includes VAT of £16.67");
    expect(vatIncludedText(0)).toBe("No VAT");
    expect(priceVatNote("reduced")).toBe("Includes VAT");
    expect(priceVatNote("exempt")).toBe("No VAT");
  });

  it("labels how an order was charged, reading an old line as standard", () => {
    expect(vatRateLabel([null, "standard"])).toBe("20%");
    expect(vatRateLabel(["reduced"])).toBe("5%");
    expect(vatRateLabel(["zero", "zero"])).toBe("zero-rated");
    expect(vatRateLabel(["exempt"])).toBe("exempt");
    expect(vatRateLabel(["zero", "standard"])).toBe("mixed rates");
    expect(vatRateLabel([])).toBe("20%");
  });
});
