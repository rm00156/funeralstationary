import { describe, expect, it } from "vitest";
import { shouldTrackUrl } from "./analytics";

describe("shouldTrackUrl", () => {
  it("tracks customer pages", () => {
    expect(shouldTrackUrl("https://example.com/")).toBe(true);
    expect(shouldTrackUrl("https://example.com/products/order-of-service?category=floral")).toBe(true);
    expect(shouldTrackUrl("https://example.com/design?design=abc")).toBe(true);
  });

  it("skips headless proof and thumbnail renders", () => {
    expect(shouldTrackUrl("https://example.com/proof-render")).toBe(false);
    expect(shouldTrackUrl("https://example.com/proof-render?page=0")).toBe(false);
  });

  it("skips the admin area, including sign-in", () => {
    expect(shouldTrackUrl("https://example.com/admin")).toBe(false);
    expect(shouldTrackUrl("https://example.com/admin/orders/123")).toBe(false);
    expect(shouldTrackUrl("https://example.com/admin/login?email=a@b.com")).toBe(false);
  });

  it("matches whole path segments, not prefixes of a word", () => {
    expect(shouldTrackUrl("https://example.com/administration")).toBe(true);
    expect(shouldTrackUrl("https://example.com/proof-renderer")).toBe(true);
  });
});
