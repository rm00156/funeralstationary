import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CheckoutForm from "@/components/CheckoutForm";
import type { Cart } from "@/lib/orders.server";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Only what the form reads: its prefilled details, the lines in the summary and the totals.
const cart = {
  id: "order-1",
  orderNumber: "TFS-2026-000001",
  items: [],
  details: {
    contactName: "Sam Hollis",
    contactEmail: "sam@hollis.example",
    contactPhone: null,
    addressLine1: "1 High St",
    addressLine2: null,
    city: "Beckenham",
    postcode: "BR3 1QZ",
  },
  serviceDate: null,
  reviewOptOut: null,
  trade: { familyName: "Harper family", customerRef: null },
  tradeDiscountPercent: 10,
  totals: { subtotalPence: 9000, deliveryPence: 0, totalPence: 9000, vatPence: 1500, vatRate: 0.2 },
  ready: true,
} as unknown as Cart;

const navigate = vi.fn();

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ url: "/orders/order-1?placed=1" }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, assign: navigate });
  return fetchMock;
}

describe("CheckoutForm on account", () => {
  it("offers account first, and places the order there without a card", async () => {
    const fetchMock = stubFetch();
    render(
      <CheckoutForm
        cart={cart}
        cancelled={false}
        paymentsConfigured={false}
        tradeFirmName="Hollis & Daughters"
        account={{ paymentTermsDays: 30, invoicesTo: "accounts@hollis.example" }}
      />,
    );
    expect(screen.getByRole("radio", { name: /On account/ })).toBeChecked();
    expect(screen.getByText(/We’ll invoice accounts@hollis.example, and payment is due 30 days after the invoice/)).toBeInTheDocument();
    // Card payments being off doesn't matter on account.
    expect(screen.queryByText(/Online payments are not configured/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Place order on account · £90.00" }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/orders/order-1?placed=1"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/checkout/account");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ familyName: "Harper family" });
  });

  it("can still pay by card", async () => {
    const fetchMock = stubFetch();
    render(
      <CheckoutForm
        cart={cart}
        cancelled={false}
        paymentsConfigured
        tradeFirmName="Hollis & Daughters"
        account={{ paymentTermsDays: 30, invoicesTo: null }}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Pay now by card/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pay £90.00 securely/ }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/checkout");
  });

  it("doesn't offer account to anyone not allowed it", () => {
    render(<CheckoutForm cart={cart} cancelled={false} paymentsConfigured tradeFirmName="Hollis & Daughters" />);
    expect(screen.queryByRole("radio", { name: /On account/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Pay £90.00 securely/ })).toBeEnabled();
  });
});
