import { describe, expect, it } from "vitest";
import {
  TURNSTILE_TEST_SECRET_KEY,
  TURNSTILE_TEST_SITE_KEY,
  isTurnstileLive,
  turnstileFailure,
  turnstileSecret,
  turnstileSiteKey,
  turnstileSiteKeyProblem,
  turnstileTokenFrom,
} from "@/lib/turnstile";

const REAL_SITE_KEY = "0x4AAAAAAD6zdAj7DtanmzlU";
const A_SECRET = "0x4AAAAAAD6zdAj7DtanmzlUxxxxxxxxxxxx";

describe("which keys are in play", () => {
  it("is live on the production deploy only", () => {
    expect(isTurnstileLive("production")).toBe(true);
    expect(isTurnstileLive("preview")).toBe(false);
    expect(isTurnstileLive(undefined)).toBe(false);
  });

  it("renders the real site key live, and Cloudflare's test key everywhere else", () => {
    expect(turnstileSiteKey(true, REAL_SITE_KEY)).toBe(REAL_SITE_KEY);
    expect(turnstileSiteKey(false, REAL_SITE_KEY)).toBe(TURNSTILE_TEST_SITE_KEY);
    expect(turnstileSiteKey(true, null)).toBe(TURNSTILE_TEST_SITE_KEY);
  });

  it("verifies with the real secret live, failing closed when it's missing", () => {
    expect(turnstileSecret({ VERCEL_ENV: "production", TURNSTILE_SECRET_KEY: " secret " })).toBe("secret");
    expect(turnstileSecret({ VERCEL_ENV: "production" })).toBeNull();
    expect(turnstileSecret({ VERCEL_ENV: "production", TURNSTILE_SECRET_KEY: "" })).toBeNull();
  });

  it("verifies with the test secret off production, whatever is set", () => {
    expect(turnstileSecret({})).toBe(TURNSTILE_TEST_SECRET_KEY);
    expect(turnstileSecret({ VERCEL_ENV: "preview", TURNSTILE_SECRET_KEY: "secret" })).toBe(TURNSTILE_TEST_SECRET_KEY);
  });
});

describe("turnstileSiteKeyProblem", () => {
  it("stops a production build with no real site key", () => {
    expect(turnstileSiteKeyProblem("production", null)).toMatch(/is not set/);
    expect(turnstileSiteKeyProblem("production", REAL_SITE_KEY)).toBeNull();
  });

  it("lets development and previews build without one", () => {
    expect(turnstileSiteKeyProblem(undefined, null)).toBeNull();
    expect(turnstileSiteKeyProblem("preview", null)).toBeNull();
  });

  it("stops any build whose site key is long enough to be the secret", () => {
    expect(turnstileSiteKeyProblem(undefined, A_SECRET)).toMatch(/looks like a Turnstile SECRET key/);
  });
});

describe("turnstileFailure", () => {
  it("answers missing configuration like a missing mail provider", () => {
    expect(turnstileFailure({ ok: false, reason: "config_error" })).toMatchObject({
      status: 503,
      body: { reason: "unavailable" },
    });
  });

  it("asks for the check again when Cloudflare refuses or can't be reached", () => {
    for (const reason of ["verify_failed", "verify_request_failed"] as const) {
      expect(turnstileFailure({ ok: false, reason })).toMatchObject({
        status: 400,
        body: { reason: "captcha_failed" },
      });
    }
  });
});

describe("turnstileTokenFrom", () => {
  it("reads a string token and treats anything else as none", () => {
    expect(turnstileTokenFrom({ turnstileToken: " tok " })).toBe("tok");
    expect(turnstileTokenFrom({ turnstileToken: 42 })).toBe("");
    expect(turnstileTokenFrom(null)).toBe("");
  });
});
