import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import OrderLinePreview from "@/components/OrderLinePreview";
import type { DesignDoc, DesignPage } from "@/lib/designEditor";

beforeAll(() => {
  // jsdom has no ResizeObserver; the booklet fits itself to its stage with one.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const page = (id: string): DesignPage => ({ id, elements: [] });
const doc: DesignDoc = { pages: [page("a"), page("b"), page("c"), page("d")] } as DesignDoc;

describe("OrderLinePreview", () => {
  it("opens the design preview with every page, named", () => {
    render(<OrderLinePreview doc={doc} name="Midnight" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview Midnight" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Midnight");
    for (const label of ["Front cover", "Page 2", "Page 3", "Back cover"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("switches to the booklet and back", () => {
    render(<OrderLinePreview doc={doc} name="Midnight" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    fireEvent.click(screen.getByRole("button", { name: "Booklet" }));
    expect(screen.getByRole("button", { name: "Booklet" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Page 2")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pages" }));
    expect(screen.getByText("Page 2")).toBeTruthy();
  });

  it("closes on Escape and on the close button", () => {
    render(<OrderLinePreview doc={doc} name="Midnight" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
