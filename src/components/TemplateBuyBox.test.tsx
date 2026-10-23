import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TemplateBuyBox from "@/components/TemplateBuyBox";
import { BOOKLET_FORMAT } from "@/lib/designEditor";
import type { PricingData } from "@/lib/orderOfServicePricing";

afterEach(cleanup);

const PRICING: PricingData = {
  quantity: [{ id: "15", label: "15", value: 15, multiplier: 1 }],
  pages: [
    { id: "4", label: "4 page", pages: 4, baseRatePence: 200 },
    { id: "8", label: "8 page", pages: 8, baseRatePence: 300 },
  ],
  paper: [{ id: "silk", label: "Silk", multiplier: 1 }],
  delivery: [{ id: "standard", label: "Standard delivery", pricePence: 0, note: "Free" }],
  size: [],
};

const SIZED: PricingData = {
  ...PRICING,
  size: [
    { id: "a5", label: "A5", multiplier: 1, widthMm: 148, heightMm: 210 },
    { id: "a4", label: "A4", multiplier: 1.5, widthMm: 210, heightMm: 297 },
  ],
};

const renderBox = (pricing: PricingData) =>
  render(
    <TemplateBuyBox
      productId="order-of-service"
      templateId="classic"
      pricing={pricing}
      format={BOOKLET_FORMAT}
      vatTreatment="zero"
      shopOpen
    />,
  );

describe("TemplateBuyBox", () => {
  it("asks for a size only when the product is sold in several", () => {
    renderBox(PRICING);
    expect(screen.queryByRole("group", { name: "Size" })).toBeNull();
    cleanup();

    renderBox({ ...SIZED, size: SIZED.size.slice(0, 1) });
    expect(screen.queryByRole("group", { name: "Size" })).toBeNull();
    cleanup();

    renderBox(SIZED);
    expect(screen.getByRole("group", { name: "Size" })).toBeTruthy();
  });

  it("prices the size chosen and carries it to the editor", () => {
    renderBox(SIZED);
    const personalise = () => screen.getByRole("link", { name: /Personalise this design/ }).getAttribute("href");
    expect(personalise()).toContain("size=a5");
    expect(screen.getByText("£30.00")).toBeTruthy(); // 15 × £2.00

    fireEvent.click(screen.getByRole("button", { name: "A4" }));
    expect(personalise()).toContain("size=a4");
    expect(screen.getByText("£45.00")).toBeTruthy(); // 15 × £3.00
  });
});
