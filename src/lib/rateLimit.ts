/**
 * A fixed-window, in-memory rate limiter for public endpoints that cost
 * something per request (an email, a catalogue query). Pure apart from the
 * Map it closes over, so it unit-tests with an injected clock.
 *
 * In-memory means per server instance: on Vercel each warm function keeps its
 * own count, so this is a speed bump against a script hammering one endpoint,
 * not a hard global quota. That is the right size for the contact form; reach
 * for a shared store only if something needs a real guarantee.
 */

export interface RateLimiter {
  /** Records one hit for `key` and says whether it is within the limit. */
  hit(key: string, now?: number): boolean;
}

/** Past this many tracked keys, expired windows are swept on the next hit. */
const SWEEP_AT = 10_000;

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    hit(key, now = Date.now()) {
      if (windows.size > SWEEP_AT) {
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      }
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return limit >= 1;
      }
      current.count += 1;
      return current.count <= limit;
    },
  };
}

/**
 * The caller's IP, for keying a limiter. Vercel overwrites `x-forwarded-for`
 * with the real client address, so its first entry is trustworthy there; off
 * Vercel every caller without one shares the "unknown" bucket, which errs on
 * the side of limiting.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
