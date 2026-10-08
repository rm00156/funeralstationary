import type { NextRequest } from "next/server";

import { fetchGoogleReviews } from "@/lib/googleReviews.server";
import { clientKey, createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Each call is a paid Places request, so one visitor can't run up the bill.
// Loose enough for many visitors behind one address (a mobile carrier, an
// office); the hard ceiling is the key's daily quota in Google Cloud, since
// this limiter is in memory and per instance.
const limiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });

/**
 * GET /api/google-reviews — the business's Google reviews for the home page,
 * asked for by the section when it is scrolled near (GoogleReviewCards).
 * `no-store` all the way: Google's terms forbid caching anything but the
 * place ID, at the CDN or in the browser.
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!limiter.hit(clientKey(request.headers))) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers });
  }
  const data = await fetchGoogleReviews();
  if (!data)
    return Response.json({ error: "Google reviews unavailable" }, { status: 503, headers });
  return Response.json(data, { headers });
}
