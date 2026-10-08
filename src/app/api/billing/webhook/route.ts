import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { billingEventCustomerId } from "@/lib/siteAccess";
import {
  constructBillingWebhookEvent,
  isSiteBillingCustomer,
  syncSiteSubscription,
} from "@/lib/siteBilling.server";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhook — the billing account's subscription events, on
 * their own endpoint and signing secret (BILLING_STRIPE_WEBHOOK_SECRET),
 * separate from the order webhook: the subscription is billed on a different
 * Stripe account from the customers' orders once the shop's checkout moves to
 * the business's own account.
 *
 * The event only says "something changed"; the state is re-read from Stripe
 * (syncSiteSubscription), so delivery order doesn't matter. The account may be
 * shared (Thintent bills its own shops on it), so an event for any other
 * customer is answered 200 and ignored. Only a bad signature is a 400.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = constructBillingWebhookEvent(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    const status = /not set|not configured/.test(message) ? 503 : 400;
    return Response.json({ error: message }, { status });
  }

  const customerId = billingEventCustomerId(event);
  if (customerId === undefined) return Response.json({ received: true });
  if (!(await isSiteBillingCustomer(customerId))) {
    return Response.json({ received: true, ignored: "another customer" });
  }
  await syncSiteSubscription();
  return Response.json({ received: true, synced: true });
}
