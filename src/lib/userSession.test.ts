import { afterEach, describe, expect, it, vi } from "vitest";

import {
  USER_SESSION_SECONDS,
  authConfigured,
  createUserToken,
  verifyUserToken,
} from "@/lib/userSession";

const NOW = 1_750_000_000_000;
const USER = "3f8a1c2e-9b4d-4e6f-8a1b-2c3d4e5f6a7b";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authConfigured", () => {
  it("needs AUTH_SECRET in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(authConfigured()).toBe(false);
    vi.stubEnv("AUTH_SECRET", "s3cret");
    expect(authConfigured()).toBe(true);
  });

  it("works with no setup in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "");
    expect(authConfigured()).toBe(true);
    const token = createUserToken(USER, NOW)!;
    expect(verifyUserToken(token, NOW)).toBe(USER);
  });
});

describe("createUserToken / verifyUserToken", () => {
  it("round-trips the user id", () => {
    vi.stubEnv("AUTH_SECRET", "s3cret");
    const token = createUserToken(USER, NOW);
    expect(token).toBeTruthy();
    expect(verifyUserToken(token!, NOW)).toBe(USER);
  });

  it("mints nothing when accounts are off, and verifies nothing either", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "s3cret");
    const token = createUserToken(USER, NOW)!;
    vi.stubEnv("AUTH_SECRET", "");
    expect(createUserToken(USER, NOW)).toBeNull();
    expect(verifyUserToken(token, NOW)).toBeNull();
  });

  it("refuses a non-uuid user id", () => {
    vi.stubEnv("AUTH_SECRET", "s3cret");
    expect(createUserToken("admin", NOW)).toBeNull();
  });

  it("expires", () => {
    vi.stubEnv("AUTH_SECRET", "s3cret");
    const token = createUserToken(USER, NOW)!;
    expect(verifyUserToken(token, NOW + USER_SESSION_SECONDS * 1000 - 1)).toBe(USER);
    expect(verifyUserToken(token, NOW + USER_SESSION_SECONDS * 1000)).toBeNull();
  });

  it("rejects a token whose user id or expiry was edited", () => {
    vi.stubEnv("AUTH_SECRET", "s3cret");
    const token = createUserToken(USER, NOW)!;
    const [id, expires, mac] = token.split(".");
    const otherUser = "7b6a5f4e-3d2c-4b1a-9f8e-7d6c5b4a3f2e";
    expect(verifyUserToken(`${otherUser}.${expires}.${mac}`, NOW)).toBeNull();
    expect(verifyUserToken(`${id}.${Number(expires) + 1}.${mac}`, NOW)).toBeNull();
    expect(verifyUserToken(`${id}.${expires}.${mac}.extra`, NOW)).toBeNull();
    expect(verifyUserToken("garbage", NOW)).toBeNull();
  });

  it("is invalidated by rotating the secret", () => {
    vi.stubEnv("AUTH_SECRET", "s3cret");
    const token = createUserToken(USER, NOW)!;
    vi.stubEnv("AUTH_SECRET", "rotated");
    expect(verifyUserToken(token, NOW)).toBeNull();
  });
});
