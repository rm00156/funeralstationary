import { afterEach, describe, expect, it, vi } from "vitest";

import { adminMutate, adminRequest } from "@/lib/adminClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adminRequest", () => {
  it("returns the body on success, and sends JSON only when there is a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ email: "jo@example.com" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await adminRequest("/api/admin/access", "POST", { email: "jo@example.com" })).toEqual({
      ok: true,
      body: { email: "jo@example.com" },
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: '{"email":"jo@example.com"}' });

    await adminRequest("/api/admin/access/1", "DELETE");
    expect(fetchMock.mock.calls[1][1]).toEqual({ method: "DELETE" });
  });

  it("says the session expired on a 401, whatever the server's message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Unauthorised" }, { status: 401 })));
    expect(await adminRequest("/x", "POST", {})).toEqual({
      ok: false,
      error: "Your admin session has expired — sign in again",
    });
  });

  it("passes the server's error on, with a fallback when there isn't one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Already has access" }, { status: 409 })));
    expect(await adminRequest("/x", "POST", {})).toEqual({ ok: false, error: "Already has access" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    expect(await adminRequest("/x", "POST", {})).toEqual({ ok: false, error: "Something went wrong — please try again" });
  });

  it("reports a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await adminRequest("/x", "PATCH", {})).toEqual({ ok: false, error: "Something went wrong — please try again" });
  });
});

describe("adminMutate", () => {
  it("is null on success and the message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await adminMutate("/x", "DELETE")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Nope" }, { status: 409 })));
    expect(await adminMutate("/x", "DELETE")).toBe("Nope");
  });
});
