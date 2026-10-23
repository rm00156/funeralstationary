import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminPricingEditor from "@/components/AdminPricingEditor";
import type { AdminOption, AdminProduct, OptionKind } from "@/lib/adminCatalogue.server";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

const PRODUCT: AdminProduct = {
  slug: "order-of-service",
  label: "Order of Service Booklets",
  description: null,
  occasion: "service",
  vatTreatment: "zero",
  sortOrder: 0,
  isActive: true,
  sizeLabel: "A5",
  trimWidthMm: 148,
  trimHeightMm: 210,
  templatePages: 3,
  sizedByOption: false,
  paperLabel: "Paper",
  templateCount: 1,
  publishedTemplateCount: 1,
};

const option = (slug: string, extra: Partial<AdminOption> = {}): AdminOption => ({
  slug,
  label: slug,
  note: null,
  sortOrder: 0,
  isActive: true,
  ...extra,
});

const OPTIONS: Record<OptionKind, AdminOption[]> = {
  quantity: [
    option("15", { multiplier: 1, copies: 15 }),
    option("25", { multiplier: 0.95, copies: 25, isActive: false }),
    option("100", { multiplier: 0.3, copies: 100 }),
  ],
  "page-count": [option("8", { label: "8 page", pageCount: 8, baseRatePence: 400 })],
  paper: [option("silk", { label: "Silk", multiplier: 1 })],
  delivery: [option("standard", { label: "Standard delivery", pricePence: 0, note: "Free" })],
  size: [option("a5", { label: "A5", multiplier: 1, widthMm: 148, heightMm: 210 })],
};

const stubFetch = (body: unknown = { ok: true }, status = 200) => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const total = () => within(screen.getByRole("complementary", { name: "Quote preview" })).getByText(/^£\d/, {
  selector: ".font-display",
});

describe("AdminPricingEditor", () => {
  it("lists the tables with their counts and prices the first active option of each", () => {
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    const nav = screen.getByRole("navigation", { name: "Pricing sections" });
    expect(within(nav).getByRole("button", { name: /Quantities\s*3/ })).toHaveAttribute("aria-current", "true");
    expect(within(nav).getByRole("button", { name: /Print sizes\s*1/ })).toBeInTheDocument();
    // 15 copies × £4.00.
    expect(total()).toHaveTextContent("£60.00");
    expect(screen.getByText("slug 15 · used in the preview")).toBeInTheDocument();
  });

  it("holds an edit until saved, previews it, and summarises it", () => {
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    fireEvent.change(screen.getByLabelText("Multiplier for 15"), { target: { value: "0.5" } });
    expect(total()).toHaveTextContent("£30.00");
    expect(screen.getByText("1 unsaved change").parentElement).toHaveTextContent(
      "1 unsaved change · 15 copies, multiplier 1 → 0.5",
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText("Multiplier for 15")).toHaveValue("1");
    expect(total()).toHaveTextContent("£60.00");
  });

  it("keeps a table's edits when moving to another, marking it unsaved", () => {
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    fireEvent.change(screen.getByLabelText("Multiplier for 15"), { target: { value: "0.5" } });
    const nav = screen.getByRole("navigation", { name: "Pricing sections" });
    fireEvent.click(within(nav).getByRole("button", { name: /Page counts/ }));
    expect(within(nav).getByRole("button", { name: /Quantities, unsaved changes/ })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: /Quantities/ }));
    expect(screen.getByLabelText("Multiplier for 15")).toHaveValue("0.5");
  });

  it("saves only the changed columns of the changed rows", async () => {
    const fetchMock = stubFetch({ option: {} });
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    fireEvent.change(screen.getByLabelText("Multiplier for 100"), { target: { value: "0.2993" } });
    fireEvent.change(screen.getByLabelText("Note for 100"), { target: { value: "Most chosen" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/products/order-of-service/options/quantity/100");
    expect(JSON.parse(init.body)).toEqual({ multiplier: 0.2993, note: "Most chosen" });
  });

  it("doesn't send a value that won't parse", () => {
    const fetchMock = stubFetch();
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    fireEvent.change(screen.getByLabelText("Copies for 15"), { target: { value: "fifteen" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    return waitFor(() => {
      expect(screen.getByText("Copies must be a number")).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("saves the Active switch straight away", async () => {
    const fetchMock = stubFetch({ option: {} });
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("switch", { name: "25 active" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ isActive: true });
    expect(screen.getByRole("switch", { name: "25 active" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves an option by keyboard and saves the table's order", async () => {
    const fetchMock = stubFetch();
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Move 100/ }), { key: "ArrowUp" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/products/order-of-service/options/quantity");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ order: ["15", "100", "25"] });
  });

  it("adds an option after the last one, with a slug from its label", async () => {
    const fetchMock = stubFetch({ option: {} }, 201);
    render(<AdminPricingEditor product={PRODUCT} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Add quantity" }));
    const form = screen.getByRole("form", { name: "New quantity" });
    fireEvent.change(within(form).getByLabelText("Label"), { target: { value: "500" } });
    fireEvent.change(within(form).getByLabelText("Multiplier"), { target: { value: "0.17" } });
    fireEvent.change(within(form).getByLabelText("Copies"), { target: { value: "500" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add quantity" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      slug: "500",
      label: "500",
      note: null,
      sortOrder: 1,
      multiplier: 0.17,
      copies: 500,
    });
  });

  it("says when a table has nothing active to price", () => {
    render(<AdminPricingEditor product={PRODUCT} options={{ ...OPTIONS, delivery: [] }} />);
    expect(screen.getByText(/Nothing to price yet/)).toBeInTheDocument();
  });
});
