"use client";

import { Analytics } from "@vercel/analytics/next";
import { shouldTrackUrl } from "@/lib/analytics";

/**
 * Vercel Web Analytics, minus the pages that aren't customer traffic (see
 * shouldTrackUrl). A client component because `beforeSend` is a function,
 * which a server component can't pass as a prop. Sends nothing outside a
 * Vercel production deployment.
 */
export default function SiteAnalytics() {
  return <Analytics beforeSend={(event) => (shouldTrackUrl(event.url) ? event : null)} />;
}
