import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrustStrip from "@/components/TrustStrip";

describe("TrustStrip", () => {
  it("renders the trust rating and review count", () => {
    render(<TrustStrip />);
    expect(screen.getByText("4.9")).toBeInTheDocument();
    expect(screen.getByText(/164 reviews on/)).toBeInTheDocument();
  });
});
