import { describe, expect, it } from "vitest";

import {
  adminLoginLinkUrl,
  adminSignInPageUrl,
  generateLoginSecret,
  hashLoginSecret,
  isValidEmail,
  loginLinkUrl,
  normaliseEmail,
  safeNextPath,
} from "@/lib/auth";

describe("normaliseEmail", () => {
  it("trims and lower-cases so one inbox is one account", () => {
    expect(normaliseEmail("  Jo@Example.COM ")).toBe("jo@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts an ordinary address and rejects junk", () => {
    expect(isValidEmail("jo@example.com")).toBe(true);
    expect(isValidEmail("jo")).toBe(false);
    expect(isValidEmail("jo@example")).toBe(false);
    expect(isValidEmail("jo @example.com")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a site-relative path", () => {
    expect(safeNextPath("/orders/abc?placed=1")).toBe("/orders/abc?placed=1");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example/x")).toBe("/account");
    expect(safeNextPath("/\\evil.example")).toBe("/account");
    expect(safeNextPath("/x\r\nLocation: y")).toBe("/account");
    expect(safeNextPath(undefined)).toBe("/account");
    expect(safeNextPath(42, "/orders")).toBe("/orders");
  });
});

describe("login secrets", () => {
  it("are long, URL-safe and never stored in the clear", () => {
    const secret = generateLoginSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(generateLoginSecret()).not.toBe(secret);
    const hash = hashLoginSecret(secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(secret);
    expect(hashLoginSecret(secret)).toBe(hash);
  });

  it("builds the verify URL with the secret encoded", () => {
    expect(loginLinkUrl("https://tfs.example", "ab+c")).toBe(
      "https://tfs.example/api/auth/verify?token=ab%2Bc",
    );
  });
});

describe("admin link URLs", () => {
  it("sends an admin's link to the admin verify route, never the customer one", () => {
    expect(adminLoginLinkUrl("https://tfs.example", "a+b/c")).toBe(
      "https://tfs.example/api/admin/verify?token=a%2Bb%2Fc",
    );
  });

  it("links an invitation to the sign-in page with the address filled in", () => {
    expect(adminSignInPageUrl("https://tfs.example", "jo+shop@example.com")).toBe(
      "https://tfs.example/admin/login?email=jo%2Bshop%40example.com",
    );
  });
});
