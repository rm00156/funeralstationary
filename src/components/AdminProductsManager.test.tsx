import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import AdminProductsManager, { type AdminProductRow } from "@/components/AdminProductsManager";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
  push.mockReset();
});

const row = (slug: string, label: string, extra: Partial<AdminProductRow> = {}): AdminProductRow => ({
  slug,
  label,
  description: null,
  occasion: "service",
  vatTreatment: "standard",
  sortOrder: 0,
  isActive: true,
  sizeLabel: "A6",
  trimWidthMm: 105,
  trimHeightMm: 148,
  templatePages: 2,
  sizedByOption: false,
  paperLabel: "Paper",
  templateCount: 1,
  publishedTemplateCount: 1,
  from: { pence: 1100, copies: 10 },
  ...extra,
});

const PRODUCTS = [
  row("order-of-service", "Order of Service Booklets", {
    vatTreatment: "zero",
    description: "Personalise online with their photographs and words.",
    from: { pence: 3300, copies: 15 },
  }),
  row("thank-you", "Thank You Cards", { occasion: "after", from: { pence: 950, copies: 10 } }),
  row("memorial-card", "Memorial Cards"),
  row("pet-card", "Pet Sympathy Cards", { occasion: "after", isActive: false, from: null }),
];

const rowFor = (label: string) => screen.getByText(label).closest("tr")!;

function stubFetch(body: unknown = { ok: true }, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AdminProductsManager", () => {
  it("groups products by shop group with their VAT and price from", () => {
    render(<AdminProductsManager products={PRODUCTS} />);
    const rows = screen.getAllByRole("row").map((tr) => tr.textContent);
    expect(rows[1]).toContain("For the service2 products");
    expect(rows[2]).toContain("Order of Service Booklets");
    expect(rows[3]).toContain("Memorial Cards");
    expect(rows[4]).toContain("After the service2 products");
    expect(within(rowFor("Order of Service Booklets")).getByText("Zero-rated")).toBeInTheDocument();
    expect(rowFor("Order of Service Booklets").textContent).toContain("£33.00 · 15 copies");
    expect(within(rowFor("Pet Sympathy Cards")).getByText("Not priced yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All\s*4/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Inactive\s*1/ })).toBeInTheDocument();
  });

  it("searches and filters, and turns reordering off while it does", () => {
    render(<AdminProductsManager products={PRODUCTS} />);
    fireEvent.change(screen.getByLabelText("Search products"), { target: { value: "cards" } });
    expect(screen.queryByText("Order of Service Booklets")).toBeNull();
    expect(screen.getByText("Memorial Cards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Move Memorial Cards/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Search products"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Inactive\s*1/ }));
    expect(screen.queryByText("Memorial Cards")).toBeNull();
    expect(screen.getByText("Pet Sympathy Cards")).toBeInTheDocument();
  });

  it("saves the Active switch straight away, and puts it back if the save fails", async () => {
    const fetchMock = stubFetch({ error: "Nope" }, 400);
    render(<AdminProductsManager products={PRODUCTS} />);
    const toggle = screen.getByRole("switch", { name: "Memorial Cards active" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Memorial Cards: Nope"));
    expect(toggle).toHaveAttribute("aria-checked", "true");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/products/memorial-card");
    expect(JSON.parse(init.body)).toEqual({ isActive: false });
  });

  it("moves a product within its group by keyboard and saves the whole range's order", async () => {
    const fetchMock = stubFetch();
    render(<AdminProductsManager products={PRODUCTS} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Move Memorial Cards/ }), { key: "ArrowUp" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/products");
    expect(init.method).toBe("PUT");
    // The after-the-service product keeps its place between them.
    expect(JSON.parse(init.body)).toEqual({
      order: ["memorial-card", "thank-you", "order-of-service", "pet-card"],
    });
  });

  it("doesn't save a move past the end of the group", () => {
    const fetchMock = stubFetch();
    render(<AdminProductsManager products={PRODUCTS} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Move Memorial Cards/ }), { key: "ArrowDown" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a product switched off, from a slug suggested by its name, then opens its pricing", async () => {
    const fetchMock = stubFetch({ product: {} }, 201);
    render(<AdminProductsManager products={PRODUCTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = screen.getByRole("dialog", { name: "New product" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Memorial Candles" } });
    expect(within(dialog).getByLabelText("Slug")).toHaveValue("memorial-candles");
    expect(within(dialog).getByRole("switch", { name: "Active" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Shop group"), { target: { value: "after" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Create and set pricing/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/products/memorial-candles"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      slug: "memorial-candles",
      label: "Memorial Candles",
      occasion: "after",
      vatTreatment: "standard",
      isActive: false,
    });
  });

  it("stops following the name once the slug is typed", () => {
    render(<AdminProductsManager products={PRODUCTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = screen.getByRole("dialog", { name: "New product" });
    fireEvent.change(within(dialog).getByLabelText("Slug"), { target: { value: "candles" } });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Memorial Candles" } });
    expect(within(dialog).getByLabelText("Slug")).toHaveValue("candles");
  });

  it("edits a product with its slug locked, saving only once something changed", async () => {
    const fetchMock = stubFetch({ product: {} });
    render(<AdminProductsManager products={PRODUCTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Order of Service Booklets" }));
    const dialog = screen.getByRole("dialog", { name: "Edit product" });
    expect(within(dialog).getByLabelText("Slug")).toHaveAttribute("readonly");
    expect(within(dialog).getByText("Customers can see and order this product.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Edit pricing/ })).toHaveAttribute(
      "href",
      "/admin/products/order-of-service",
    );
    const save = within(dialog).getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("VAT"), { target: { value: "standard" } });
    fireEvent.click(save);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      label: "Order of Service Booklets",
      description: "Personalise online with their photographs and words.",
      occasion: "service",
      vatTreatment: "standard",
      isActive: true,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says an active product customers can't see yet is waiting on pricing", () => {
    render(
      <AdminProductsManager products={[row("candle", "Candles", { from: null, publishedTemplateCount: 0 })]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Candles" }));
    expect(
      screen.getByText("Customers won't see it until it has a published design and pricing for every option."),
    ).toBeInTheDocument();
  });
});
