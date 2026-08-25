import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_SECONDS,
  adminConfigured,
  createAdminToken,
  passwordMatches,
  verifyAdminToken,
} from "@/lib/adminSession";

const NOW = 1_750_000_000_000;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("adminConfigured", () => {
  it("is false until ADMIN_PASSWORD is set", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminConfigured()).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    expect(adminConfigured()).toBe(true);
  });
});

describe("createAdminToken / verifyAdminToken", () => {
  it("round-trips a freshly minted token", () => {
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    const token = createAdminToken(NOW);
    expect(token).toBeTruthy();
    expect(verifyAdminToken(token!, NOW)).toBe(true);
  });

  it("returns null when admin is not configured", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(createAdminToken(NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    const token = createAdminToken(NOW)!;
    const afterExpiry = NOW + (ADMIN_SESSION_SECONDS + 1) * 1000;
    expect(verifyAdminToken(token, afterExpiry)).toBe(false);
  });

  it("rejects a token whose expiry was tampered with", () => {
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    const token = createAdminToken(NOW)!;
    const [expires, mac] = token.split(".");
    const tampered = `${Number(expires) + 3600}.${mac}`;
    expect(verifyAdminToken(tampered, NOW)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    const token = createAdminToken(NOW)!;
    vi.stubEnv("ADMIN_PASSWORD", "different-password");
    expect(verifyAdminToken(token, NOW)).toBe(false);
  });

  it("rejects garbage tokens", () => {
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    expect(verifyAdminToken("", NOW)).toBe(false);
    expect(verifyAdminToken("not-a-token", NOW)).toBe(false);
    expect(verifyAdminToken("123.zzzz", NOW)).toBe(false);
  });

  it("prefers ADMIN_SESSION_SECRET as the signing key when set", () => {
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    vi.stubEnv("ADMIN_SESSION_SECRET", "separate-secret");
    const token = createAdminToken(NOW)!;
    // Changing the password no longer invalidates sessions…
    vi.stubEnv("ADMIN_PASSWORD", "rotated");
    expect(verifyAdminToken(token, NOW)).toBe(true);
    // …but changing the session secret does.
    vi.stubEnv("ADMIN_SESSION_SECRET", "rotated-secret");
    expect(verifyAdminToken(token, NOW)).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts only the configured password", () => {
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    expect(passwordMatches("hunter2")).toBe(true);
    expect(passwordMatches("hunter3")).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });

  it("rejects everything when admin is not configured", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(passwordMatches("hunter2")).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });
});
