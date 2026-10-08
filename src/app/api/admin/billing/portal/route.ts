import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminSession";
import { billingConfigured, openBillingPortal } from "@/lib/siteBilling.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";

/**
 * POST /api/admin/billing/portal — "Manage billing": Stripe's own pages for
 * changing the card, cancelling and downloading invoices.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return unauthorised();
  const origin = resolveRequestOrigin(request);
  const back = (message: string) =>
    Response.redirect(`${origin}/admin/billing?error=${encodeURIComponent(message)}`, 303);
  if (!billingConfigured()) return back("Billing isn’t set up yet.");
  try {
    return Response.redirect(await openBillingPortal(origin), 303);
  } catch (error) {
    console.error("Billing: couldn't open the billing portal", error);
    return back("We couldn’t open the billing page at Stripe. Please try again.");
  }
}
