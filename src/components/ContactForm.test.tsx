import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ContactForm from "@/components/ContactForm";

// Cloudflare's widget can't load under jsdom; this stands in for it.
let tokens = 0;
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess(`tok-${++tokens}`)}>
      Pass the check
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const topics = [{ id: "something-else", label: "Something else" }];
const sendButton = () => screen.getByRole("button", { name: "Send message" });

describe("ContactForm", () => {
  it("keeps Send off until the check passes, then sends its token with the message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm topics={topics} initialTopic="something-else" />);
    expect(sendButton()).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Your name" }), { target: { value: "Jean Okafor" } });
    fireEvent.click(screen.getByRole("button", { name: "Pass the check" }));
    fireEvent.click(sendButton());

    const sent = await screen.findByRole("status");
    expect(sent).toHaveTextContent("Thank you, Jean Okafor. Your message has been sent");
    // The form gives way to the confirmation, which is focused so it's seen.
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(sent).toHaveFocus();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ name: "Jean Okafor", topic: "something-else" });
    expect(body.turnstileToken).toMatch(/^tok-\d+$/);
    // Another message starts on an empty form, with a fresh check: the token was spent.
    fireEvent.click(screen.getByRole("button", { name: "Send another message" }));
    expect(screen.getByRole("textbox", { name: "Your name" })).toHaveValue("");
    expect(sendButton()).toBeDisabled();
  });

  it("starts the check again after a refused send", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "Please check the highlighted fields." }, { status: 400 })),
    );
    render(<ContactForm topics={topics} initialTopic="something-else" />);
    fireEvent.click(screen.getByRole("button", { name: "Pass the check" }));
    fireEvent.click(sendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Please check the highlighted fields.");
    expect(sendButton()).toBeDisabled();
  });
});
