import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminLoginForm from "@/components/AdminLoginForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminLoginForm", () => {
  it("starts from the address an invitation filled in", () => {
    render(<AdminLoginForm initialEmail="jo@example.com" />);
    expect(screen.getByLabelText("Your email address")).toHaveValue("jo@example.com");
  });

  it("says the same thing whether or not a link was sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, linkInTerminal: false }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminLoginForm />);

    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "jo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("If jo@example.com has admin access");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "jo@example.com" });
    expect(screen.getByRole("status")).not.toHaveTextContent("terminal");
  });

  it("points to the terminal, never puts a link on screen, in development without email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true, linkInTerminal: true })));
    render(<AdminLoginForm initialEmail="jo@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("the sign-in link is in the terminal");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the server's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "Too many attempts" }, { status: 429 })),
    );
    render(<AdminLoginForm initialEmail="jo@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
  });
});
