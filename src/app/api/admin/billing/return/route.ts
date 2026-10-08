import type { NextRequest } from "next/server";

import { isAdmin } from "@/lib/adminSession";
import { syncSiteSubscription } from "@/lib/siteBilling.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";

/**
 * GET /api/admin/billing/return — where Stripe Checkout and the billing
 * portal send the admin back to. Re-reads the subscription first, so the
 * page (and the shop) are right straight away even before the webhook
 * lands — and locally, where there's no webhook at all.
 */
export async function GET(request: NextRequest) {
  const origin = resolveRequestOrigin(request);
  if (!(await isAdmin())) return Response.redirect(`${origin}/admin/login`, 303);
  const subscribed = request.nextUrl.searchParams.get("subscribed") === "1";
  try {
    await syncSiteSubscription();
  } catch (error) {
    // The webhook will catch up; the page shows what's stored meanwhile.
    console.error("Billing: couldn't sync the subscription on return", error);
  }
  return Response.redirect(`${origin}/admin/billing${subscribed ? "?subscribed=1" : ""}`, 303);
}
