import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminSession";
import { AlreadySubscribedError, billingConfigured, startSubscriptionCheckout } from "@/lib/siteBilling.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";

/**
 * POST /api/admin/billing/checkout — the billing page's Subscribe button, a
 * plain form post: sends the admin to Stripe Checkout for the monthly
 * subscription, or back to the page with the error.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return unauthorised();
  const origin = resolveRequestOrigin(request);
  if (!billingConfigured()) return backWithError(origin, "Billing isn’t set up yet.");
  try {
    return Response.redirect(await startSubscriptionCheckout(origin), 303);
  } catch (error) {
    if (error instanceof AlreadySubscribedError) {
      return backWithError(origin, "The site is already subscribed — use “Manage billing” to change or settle it.");
    }
    console.error("Billing: couldn't start the subscription checkout", error);
    return backWithError(origin, "We couldn’t reach Stripe. Please try again.");
  }
}

function backWithError(origin: string, message: string): Response {
  return Response.redirect(`${origin}/admin/billing?error=${encodeURIComponent(message)}`, 303);
}
