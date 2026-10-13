import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminTradeApplications, { type AdminTradeApplication } from "@/components/AdminTradeApplications";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

const application = (extra: Partial<AdminTradeApplication> = {}): AdminTradeApplication => ({
  id: "3f2b8c1e-9d4a-4b7e-8a61-2c5d9e0f1a2b",
  status: "pending",
  businessName: "Hollis & Daughters",
  postcode: "BR3 1QZ",
  contactName: "Sam Hollis",
  role: "Funeral arranger",
  email: "sam@hollis.example",
  phone: "020 7946 0000",
  volume: "5 to 15",
  orders: ["Bookmarks"],
  notes: null,
  createdAt: "2026-10-13T09:00:00.000Z",
  decidedAt: null,
  decidedBy: null,
  decisionNote: null,
  firm: null,
  existingFirm: null,
  ...extra,
});

const firms = [
  { id: 1, name: "Barnes Funeral Care" },
  { id: 2, name: "Osei & Sons" },
];

describe("AdminTradeApplications", () => {
  it("approves onto a new firm named after the business, and says the applicant was emailed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ firmId: 9, firmName: "Hollis & Daughters", email: "sam@hollis.example", delivery: "sent", signInPageUrl: "x" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminTradeApplications pending={[application()]} decided={[]} activeFirms={firms} />);

    expect(screen.getByRole("heading", { name: "Applications (1 waiting)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Firm name")).toHaveValue("Hollis & Daughters");
    fireEvent.change(screen.getByLabelText("Payment terms (days)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Trade discount (%)"), { target: { value: "10" } });
    fireEvent.click(screen.getByLabelText("Can order on account (needs payment terms)"));
    fireEvent.click(screen.getByRole("button", { name: "Approve and email them" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "sam@hollis.example is now a trade account on Hollis & Daughters — we've emailed them that it's ready.",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/trade/applications/3f2b8c1e-9d4a-4b7e-8a61-2c5d9e0f1a2b/approve");
    expect(JSON.parse(init.body)).toEqual({
      kind: "new",
      name: "Hollis & Daughters",
      paymentTermsDays: "30",
      discountPercent: "10",
      onAccount: true,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("warns when the address is already on a firm, and starts on that firm", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ firmId: 2, firmName: "Osei & Sons", email: "sam@hollis.example", delivery: "not-configured", signInPageUrl: "https://tfs.example/account?email=sam" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AdminTradeApplications
        pending={[application({ existingFirm: { id: 2, firmName: "Osei & Sons", isActive: true } })]}
        decided={[]}
        activeFirms={firms}
      />,
    );
    expect(screen.getByText(/is already on/)).toHaveTextContent("sam@hollis.example is already on Osei & Sons.");
    expect(screen.getByRole("radio", { name: "An existing firm" })).toBeChecked();
    expect(screen.getByLabelText("Firm")).toHaveValue("2");
    fireEvent.click(screen.getByRole("button", { name: "Approve and email them" }));

    // Without email, the page says to pass the sign-in page on by hand.
    expect(await screen.findByRole("status")).toHaveTextContent(
      "but email isn't set up. Let them know they can sign in at https://tfs.example/account?email=sam",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ kind: "existing", firmId: 2 });
  });

  it("declines with a staff note and sends nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminTradeApplications pending={[application()]} decided={[]} activeFirms={firms} />);

    fireEvent.click(screen.getByRole("button", { name: "Decline…" }));
    expect(screen.getByText("Nothing is emailed to the applicant.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Note for staff (optional)"), { target: { value: "Not a funeral director" } });
    fireEvent.click(screen.getByRole("button", { name: "Decline application" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Hollis & Daughters’s application was declined.");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/decline$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ note: "Not a funeral director" });
  });

  it("shows the server's refusal on the card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "That application has already been approved." }, { status: 409 })),
    );
    render(<AdminTradeApplications pending={[application()]} decided={[]} activeFirms={firms} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve and email them" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That application has already been approved.");
  });

  it("lists recent decisions with the firm or the note", () => {
    render(
      <AdminTradeApplications
        pending={[]}
        decided={[
          application({ id: "a", status: "approved", firm: { id: 9, name: "Hollis & Daughters" }, decidedAt: "2026-10-13T10:00:00.000Z", decidedBy: "owner@example.com" }),
          application({ id: "b", businessName: "Spam Ltd", status: "declined", decisionNote: "Spam", decidedAt: "2026-10-13T11:00:00.000Z" }),
        ]}
        activeFirms={firms}
      />,
    );
    expect(screen.getByText("No applications waiting.")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("link", { name: "Hollis & Daughters" })).toHaveAttribute("href", "/admin/trade/9");
    expect(rows[1]).toHaveTextContent("Declined“Spam”");
  });
});
