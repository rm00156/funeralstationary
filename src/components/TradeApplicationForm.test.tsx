import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TradeApplicationForm from "@/components/TradeApplicationForm";

// Cloudflare's widget can't load under jsdom; this stands in for it, passing
// the check with a fresh token each time it is mounted (a reset remounts it).
let tokens = 0;
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess(`tok-${++tokens}`)}>
      Pass the check
    </button>
  ),
}));

const orderTypes = [
  { id: "order-of-service", label: "Order of Service Booklets" },
  { id: "bookmark", label: "Bookmarks" },
  { id: "something-else", label: "Something else" },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const sendButton = () => screen.getByRole("button", { name: "Send application" });
const pass = () => fireEvent.click(screen.getByRole("button", { name: "Pass the check" }));
const send = () => fireEvent.click(sendButton());

describe("TradeApplicationForm", () => {
  it("offers the roles as a list, with a box for their own words under Other", () => {
    render(<TradeApplicationForm orderTypes={orderTypes} />);
    const role = screen.getByRole("combobox", { name: "Your role" });
    expect(role).toHaveValue("");
    expect(role).toBeRequired();
    expect(screen.queryByRole("textbox", { name: "Tell us your role" })).toBeNull();
    fireEvent.change(role, { target: { value: "other" } });
    expect(screen.getByRole("textbox", { name: "Tell us your role" })).toBeRequired();
    fireEvent.change(role, { target: { value: "arranger" } });
    expect(screen.queryByRole("textbox", { name: "Tell us your role" })).toBeNull();
  });

  it("sends every ticked box, not just the last one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TradeApplicationForm orderTypes={orderTypes} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Business name" }), { target: { value: "Hollis & Co" } });
    fireEvent.click(screen.getByLabelText("Order of Service Booklets"));
    fireEvent.click(screen.getByLabelText("Bookmarks"));
    pass();
    send();

    const sent = await screen.findByRole("status");
    expect(sent).toHaveTextContent("Application sent");
    expect(sent).toHaveTextContent("we’ll be in touch");
    expect(sent).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Send application" })).toBeNull();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/trade");
    expect(body).toMatchObject({
      businessName: "Hollis & Co",
      volume: "under-5",
      orders: ["order-of-service", "bookmark"],
    });
    expect(body.turnstileToken).toMatch(/^tok-\d+$/);
  });

  it("keeps Send off until the check passes, and asks for a fresh check after a refused send", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ error: "We couldn't check that you're a person.", reason: "captcha_failed" }, { status: 400 }),
      ),
    );
    render(<TradeApplicationForm orderTypes={orderTypes} />);
    expect(sendButton()).toBeDisabled();
    pass();
    expect(sendButton()).toBeEnabled();
    send();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't check that you're a person.");
    expect(sendButton()).toBeDisabled();
  });

  it("shows each field's error beside it, and the phone number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: "Please check the highlighted fields.", errors: { postcode: "Please tell us your postcode." } },
          { status: 400 },
        ),
      ),
    );
    render(<TradeApplicationForm orderTypes={orderTypes} />);
    pass();
    send();

    expect(await screen.findByRole("alert")).toHaveTextContent("Please check the highlighted fields.");
    expect(screen.getByRole("alert")).toHaveTextContent("020 7277 7663");
    expect(screen.getByRole("textbox", { name: "Postcode" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Postcode" })).toHaveAccessibleDescription("Please tell us your postcode.");
    expect(screen.getByRole("textbox", { name: "Business name" })).not.toHaveAttribute("aria-invalid");
    // The asterisk is for the eye only; the field announces itself as required.
    expect(screen.getByRole("textbox", { name: "Postcode" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Anything else we should know? (optional)" })).not.toBeRequired();
    expect(screen.getByText(/Fields marked/)).toHaveTextContent("Fields marked * are required.");
    // Taken to the problem: the form is long, and the message sits above the fold.
    expect(screen.getByRole("textbox", { name: "Postcode" })).toHaveFocus();
  });
});
