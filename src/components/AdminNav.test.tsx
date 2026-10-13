import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminNav from "@/components/AdminNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/trade" }));

afterEach(cleanup);

const menuButton = () => screen.getByRole("button", { name: /Trade accounts/ });

describe("AdminNav", () => {
  it("folds the sections behind a button naming the current one, rather than a sideways strip", () => {
    render(<AdminNav openOrders={2} tradeApplications={1} />);

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("list", { hidden: true })).toHaveClass("hidden", "lg:flex");
    expect(screen.getByLabelText("3 waiting")).toBeInTheDocument();
  });

  it("opens the list, and closes it again when a section is chosen", () => {
    render(<AdminNav openOrders={0} />);

    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list")).toHaveClass("flex");
    expect(screen.getByRole("link", { name: "Trade accounts" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("link", { name: "Orders" }));
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("list", { hidden: true })).toHaveClass("hidden");
  });
});
