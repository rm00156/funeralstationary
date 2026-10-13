import { turnstileSecret, type TurnstileResult } from "@/lib/turnstile";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

/**
 * Ask Cloudflare whether a form's Turnstile token is good (rules in
 * turnstile.ts; the same check as simple-print's). A token is single-use,
 * so call this once per submission, after the cheap validation and before
 * anything is sent.
 */
export async function verifyTurnstileToken(token: string, remoteIp: string): Promise<TurnstileResult> {
  const secret = turnstileSecret({
    VERCEL_ENV: process.env.VERCEL_ENV,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  });
  if (!secret) {
    console.error("Turnstile verification skipped: TURNSTILE_SECRET_KEY is not set");
    return { ok: false, reason: "config_error" };
  }
  if (!token) return { ok: false, reason: "verify_failed" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("Turnstile siteverify request failed", res.status);
      return { ok: false, reason: "verify_request_failed" };
    }
    const data: SiteverifyResponse = await res.json();
    if (!data.success) {
      console.error("Turnstile verification rejected", data["error-codes"]);
      return { ok: false, reason: "verify_failed" };
    }
    return { ok: true };
  } catch (error) {
    console.error("Turnstile siteverify request threw", error);
    return { ok: false, reason: "verify_request_failed" };
  }
}
