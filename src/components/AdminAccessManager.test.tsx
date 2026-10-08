import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import AdminAccessManager, { type AdminAccessRow } from "@/components/AdminAccessManager";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

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
});

const row = (email: string, extra: Partial<AdminAccessRow> = {}): AdminAccessRow => ({
  id: `id-${email}`,
  email,
  isOwner: false,
  addedBy: "owner@example.com",
  lastSignInAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  ...extra,
});

const ADMINS = [
  row("owner@example.com", { isOwner: true, addedBy: null }),
  row("me@example.com"),
  row("jo@example.com"),
];

const rowFor = (email: string) => screen.getByText(email).closest("tr")!;

describe("AdminAccessManager", () => {
  it("offers Remove only for other, non-owner admins", () => {
    render(<AdminAccessManager admins={ADMINS} currentEmail="me@example.com" />);
    expect(within(rowFor("owner@example.com")).getByText("Owner")).toBeInTheDocument();
    expect(within(rowFor("owner@example.com")).queryByRole("button", { name: /remove/i })).toBeNull();
    expect(within(rowFor("me@example.com")).queryByRole("button", { name: /remove/i })).toBeNull();
    expect(within(rowFor("jo@example.com")).getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("adds an admin and says the invitation went", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { email: "new@example.com", invite: "sent", signInPageUrl: "https://tfs.example/admin/login" },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminAccessManager admins={ADMINS} currentEmail="me@example.com" />);

    fireEvent.change(screen.getByLabelText("Give someone access"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add and invite" }));

    expect(await screen.findByRole("status")).toHaveTextContent("emailed them how to sign in");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/access", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "new@example.com" });
    expect(refresh).toHaveBeenCalled();
  });

  it("hands over the sign-in page when no invitation could be emailed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { email: "new@example.com", invite: "failed", signInPageUrl: "https://tfs.example/admin/login?email=x" },
          { status: 201 },
        ),
      ),
    );
    render(<AdminAccessManager admins={ADMINS} currentEmail="me@example.com" />);
    fireEvent.change(screen.getByLabelText("Give someone access"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add and invite" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("didn't send");
    expect(status).toHaveTextContent("https://tfs.example/admin/login?email=x");
  });

  it("shows the server's refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "jo@example.com already has admin access." }, { status: 409 })),
    );
    render(<AdminAccessManager admins={ADMINS} currentEmail="me@example.com" />);
    fireEvent.change(screen.getByLabelText("Give someone access"), { target: { value: "jo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add and invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already has admin access");
  });

  it("removes an admin only after confirming", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminAccessManager admins={ADMINS} currentEmail="me@example.com" />);

    fireEvent.click(within(rowFor("jo@example.com")).getByRole("button", { name: /remove/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Remove access" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/access/id-jo@example.com", { method: "DELETE" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("jo@example.com no longer has access");
  });
});
