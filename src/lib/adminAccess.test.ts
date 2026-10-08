import { describe, expect, it } from "vitest";

import { adminLinkError, removeAdminRefusal, sortAdmins } from "@/lib/adminAccess";

describe("removeAdminRefusal", () => {
  it("never lets the owner be removed, even by themselves", () => {
    const owner = { email: "owner@example.com", isOwner: true };
    expect(removeAdminRefusal(owner, "someone@example.com")).toMatch(/owner/i);
    expect(removeAdminRefusal(owner, "owner@example.com")).toMatch(/owner/i);
  });

  it("doesn't let an admin remove themselves", () => {
    expect(removeAdminRefusal({ email: "jo@example.com", isOwner: false }, "jo@example.com")).toMatch(
      /your own access/,
    );
  });

  it("lets an admin remove another admin", () => {
    expect(removeAdminRefusal({ email: "jo@example.com", isOwner: false }, "owner@example.com")).toBeNull();
  });
});

describe("sortAdmins", () => {
  it("puts the owner first, then everyone in the order they were added", () => {
    const rows = [
      { id: "b", isOwner: false, createdAt: new Date("2026-10-02") },
      { id: "owner", isOwner: true, createdAt: new Date("2026-10-05") },
      { id: "a", isOwner: false, createdAt: new Date("2026-10-01") },
    ];
    expect(sortAdmins(rows).map((row) => row.id)).toEqual(["owner", "a", "b"]);
    expect(rows[0].id).toBe("b");
  });
});

describe("adminLinkError", () => {
  it("explains each way a link can fail", () => {
    expect(adminLinkError("expired")).toMatch(/expired/);
    expect(adminLinkError("used")).toMatch(/already been used/);
    expect(adminLinkError("revoked")).toMatch(/no longer has admin access/);
  });

  it("shows nothing without an error", () => {
    expect(adminLinkError(undefined)).toBeNull();
    expect(adminLinkError("")).toBeNull();
    expect(adminLinkError(["used", "expired"])).toBeNull();
  });

  it("reads anything else, prototype keys included, as an invalid link", () => {
    const invalid = adminLinkError("invalid");
    expect(adminLinkError("nonsense")).toBe(invalid);
    expect(adminLinkError("__proto__")).toBe(invalid);
    expect(adminLinkError("constructor")).toBe(invalid);
    expect(adminLinkError("toString")).toBe(invalid);
  });
});
