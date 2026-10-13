/**
 * Cloudflare Turnstile on the contact and trade forms — the pure half, the
 * same way simple-print does it: the public site key lives in code, the
 * secret only in the server's environment, and every submission's token is
 * checked with Cloudflare before anything is emailed
 * (turnstile.server.ts). Rules here are tested; nothing here fetches.
 *
 * Only the production deploy uses the real keys. Everywhere else —
 * `npm run dev`, preview deploys — uses Cloudflare's published test pair,
 * which always passes, so localhost and preview URLs never need adding to
 * the widget's hostnames. `NEXT_PUBLIC_TURNSTILE_LIVE` is set from
 * VERCEL_ENV by next.config.ts, so the browser and the server always agree on
 * which pair is in play.
 */

/**
 * The real SITE key, for the production widget. Inlined deliberately, like
 * simple-print's: it is the public half of the pair, downloaded by every
 * visitor, so there is nothing to protect — and a build variable for it is
 * one more field the secret can be pasted into by mistake.
 *
 * The widget is created in Cloudflare (Turnstile → Add widget, hostname
 * funeralstationary.vercel.app plus the real domain). Were it null, a
 * production build would fail on purpose (turnstileSiteKeyProblem), so the
 * forms can never go live unprotected or unable to send.
 *
 * The SECRET key never goes in this file: it is TURNSTILE_SECRET_KEY in
 * Vercel, Production only, read by turnstile.server.ts.
 */
export const TURNSTILE_PRODUCTION_SITE_KEY: string | null = "0x4AAAAAAD6zdAj7DtanmzlU";

/** Cloudflare's test keys: the widget always passes and siteverify always succeeds. */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

/** Whether this build is the production deploy, i.e. uses the real keys. */
export const isTurnstileLive = (vercelEnv: string | undefined) => vercelEnv === "production";

/** The site key the widget renders with. */
export function turnstileSiteKey(live: boolean, productionKey = TURNSTILE_PRODUCTION_SITE_KEY): string {
  return live && productionKey ? productionKey : TURNSTILE_TEST_SITE_KEY;
}

/** What the forms use. Read in the browser too, so it comes from the inlined flag. */
export const TURNSTILE_SITE_KEY = turnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_LIVE === "1");

/**
 * Why this build mustn't go out, or null. Checked by next.config.ts at build
 * time: a production deploy with no real site key, or a "site key" long
 * enough to be the secret (~35 characters against ~24) — which would publish
 * the secret in the browser bundle and fail every submission.
 */
export function turnstileSiteKeyProblem(
  vercelEnv: string | undefined,
  productionKey = TURNSTILE_PRODUCTION_SITE_KEY,
): string | null {
  if (productionKey && productionKey.length > 30) {
    return (
      `TURNSTILE_PRODUCTION_SITE_KEY in src/lib/turnstile.ts looks like a Turnstile SECRET key ` +
      `(${productionKey.length} chars). The site key is the short, public one (~24 chars); ` +
      `the secret belongs in Vercel as TURNSTILE_SECRET_KEY.`
    );
  }
  if (isTurnstileLive(vercelEnv) && !productionKey) {
    return (
      "TURNSTILE_PRODUCTION_SITE_KEY in src/lib/turnstile.ts is not set. Create the Turnstile widget " +
      "in Cloudflare and paste its site key there before deploying to production."
    );
  }
  return null;
}

/**
 * The secret the server verifies with: the real one on the production
 * deploy (null when it is missing, so the routes fail closed), the test
 * secret everywhere else.
 */
export function turnstileSecret(env: { VERCEL_ENV?: string; TURNSTILE_SECRET_KEY?: string }): string | null {
  if (!isTurnstileLive(env.VERCEL_ENV)) return TURNSTILE_TEST_SECRET_KEY;
  return env.TURNSTILE_SECRET_KEY?.trim() || null;
}

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "config_error" | "verify_failed" | "verify_request_failed" };

/**
 * A failed check as the forms' routes answer it. Missing configuration is
 * ours to fix, so it reads like a missing mail provider (503, use the phone);
 * anything else asks the visitor to do the check again.
 */
export function turnstileFailure(result: Extract<TurnstileResult, { ok: false }>): {
  status: 400 | 503;
  body: { error: string; reason: "captcha_failed" | "unavailable" };
} {
  if (result.reason === "config_error") {
    return {
      status: 503,
      body: { error: "This form isn't available right now. Please call or email us instead.", reason: "unavailable" },
    };
  }
  return {
    status: 400,
    body: {
      error: "We couldn't check that you're a person. Please do the check above the button again.",
      reason: "captcha_failed",
    },
  };
}

/** The token a form sent, or "" — a missing or non-string one simply fails verification. */
export const turnstileTokenFrom = (body: unknown): string => {
  const token = (body as Record<string, unknown> | null)?.turnstileToken;
  return typeof token === "string" ? token.trim() : "";
};
