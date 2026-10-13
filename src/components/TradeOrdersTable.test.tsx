import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TradeOrdersTable, { type TradeOrderRow } from "@/components/TradeOrdersTable";

afterEach(cleanup);

const orders: TradeOrderRow[] = [
  {
    id: "1",
    orderNumber: "TFS-2026-100001",
    status: "in_production",
    familyName: "Harper family",
    customerRef: "HAR-1021",
    serviceDate: "2026-10-14",
    lines: [{ productLabel: "Order of Service Booklets", copies: 75 }],
  },
  {
    id: "2",
    orderNumber: "TFS-2026-100002",
    status: "delivered",
    familyName: "Barnes family",
    customerRef: null,
    serviceDate: null,
    lines: [{ productLabel: "Bookmarks", copies: 100 }],
  },
];

const familyNames = () =>
  screen.queryAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("TradeOrdersTable", () => {
  it("lists every order with its family, reference, lines and plain status", () => {
    render(<TradeOrdersTable orders={orders} />);
    expect(familyNames()).toEqual(["Harper family", "Barnes family"]);
    expect(screen.getByText("Order of Service Booklets ×75")).toBeInTheDocument();
    expect(screen.getByText("Printing")).toBeInTheDocument();
    expect(screen.getByText("Wed 14 Oct")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View order TFS-2026-100001 for Harper family" })).toHaveAttribute(
      "href",
      "/orders/1",
    );
  });

  it("filters by tab, and counts each", () => {
    render(<TradeOrdersTable orders={orders} />);
    const delivered = screen.getByRole("button", { name: /Delivered/ });
    expect(delivered).toHaveTextContent("1");
    fireEvent.click(delivered);
    expect(delivered).toHaveAttribute("aria-pressed", "true");
    expect(familyNames()).toEqual(["Barnes family"]);
  });

  it("searches by reference and says when nothing matches", () => {
    render(<TradeOrdersTable orders={orders} />);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "har-1021" } });
    expect(familyNames()).toEqual(["Harper family"]);
    fireEvent.change(search, { target: { value: "nobody" } });
    expect(screen.getByRole("status")).toHaveTextContent("No orders match “nobody”.");
  });
});
