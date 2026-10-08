import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_SECONDS,
  adminConfigured,
  createAdminToken,
  verifyAdminToken,
} from "@/lib/adminSession";
import { createUserToken } from "@/lib/userSession";

const NOW = 1_750_000_000_000;
const ADMIN_ID = "5f0c2a3e-6b1d-4c8e-9a47-0d3e8b2f71c4";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("adminConfigured", () => {
  it("needs AUTH_SECRET in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(adminConfigured()).toBe(false);
    vi.stubEnv("AUTH_SECRET", "a-long-random-secret");
    expect(adminConfigured()).toBe(true);
  });

  it("works without setup in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "");
    expect(adminConfigured()).toBe(true);
  });

  it("no longer reads ADMIN_PASSWORD", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    expect(adminConfigured()).toBe(false);
  });
});

describe("createAdminToken / verifyAdminToken", () => {
  it("round-trips the admin id", () => {
    vi.stubEnv("AUTH_SECRET", "secret");
    const token = createAdminToken(ADMIN_ID, NOW);
    expect(token).toBeTruthy();
    expect(verifyAdminToken(token!, NOW)).toBe(ADMIN_ID);
  });

  it("returns null when sign-in is not configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(createAdminToken(ADMIN_ID, NOW)).toBeNull();
  });

  it("refuses to mint for something that isn't an id", () => {
    vi.stubEnv("AUTH_SECRET", "secret");
    expect(createAdminToken("admin", NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.stubEnv("AUTH_SECRET", "secret");
    const token = createAdminToken(ADMIN_ID, NOW)!;
    expect(verifyAdminToken(token, NOW + (ADMIN_SESSION_SECONDS + 1) * 1000)).toBeNull();
  });

  it("rejects a token whose id or expiry was swapped", () => {
    vi.stubEnv("AUTH_SECRET", "secret");
    const [, expires, mac] = createAdminToken(ADMIN_ID, NOW)!.split(".");
    const otherId = "11111111-2222-4333-8444-555555555555";
    expect(verifyAdminToken(`${otherId}.${expires}.${mac}`, NOW)).toBeNull();
    expect(verifyAdminToken(`${ADMIN_ID}.${Number(expires) + 3600}.${mac}`, NOW)).toBeNull();
  });

  it("is signed out by rotating AUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", "secret");
    const token = createAdminToken(ADMIN_ID, NOW)!;
    vi.stubEnv("AUTH_SECRET", "rotated");
    expect(verifyAdminToken(token, NOW)).toBeNull();
  });

  it("never accepts a customer session token", () => {
    vi.stubEnv("AUTH_SECRET", "secret");
    const customer = createUserToken(ADMIN_ID, NOW)!;
    expect(verifyAdminToken(customer, NOW)).toBeNull();
  });

  it("rejects garbage tokens", () => {
    vi.stubEnv("AUTH_SECRET", "secret");
    expect(verifyAdminToken("", NOW)).toBeNull();
    expect(verifyAdminToken("not-a-token", NOW)).toBeNull();
    expect(verifyAdminToken(`${ADMIN_ID}.123.zzzz`, NOW)).toBeNull();
    expect(verifyAdminToken(`${createAdminToken(ADMIN_ID, NOW)}.extra`, NOW)).toBeNull();
  });
});
