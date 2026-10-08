import { after, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { renderOrigin } from "@/lib/headlessBrowser.server";
import { runPostPaymentSideEffects } from "@/lib/orderFulfilment.server";
import { finaliseOrder } from "@/lib/orders.server";
import { syncStripeRefunds } from "@/lib/refunds.server";
import { pushOrderRefundsToThintent } from "@/lib/thintent.server";
import {
  constructWebhookEvent,
  eventPaymentIntentId,
  resolveRequestOrigin,
  summariseSession,
} from "@/lib/stripe.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/stripe/webhook — Stripe's delivery of Checkout and refund events.
 *
 * The body must be read raw for signature verification. Anything we can't
 * act on (an event type we don't handle, a session for an order that no
 * longer exists) is answered 200 so Stripe doesn't retry it forever; only a
 * bad signature is a 400. Finalisation is shared with the return route and
 * idempotent, so a redelivered event is harmless.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 },
    );
  }

  // Refunds: made in the Stripe dashboard, mirrored onto the order. Any of
  // these events re-reads every refund on the payment, so which ones the
  // endpoint subscribes to only changes how promptly we hear.
  const paymentIntentId = eventPaymentIntentId(event);
  if (paymentIntentId) {
    const outcome = await syncStripeRefunds(paymentIntentId);
    if (outcome.result === "unknown-order") {
      // Expected if the Stripe account is shared with another till (Thintent's own card payments).
      console.warn(`Stripe webhook: ${event.type} for payment ${paymentIntentId}, which no order has`);
    } else if (outcome.succeeded.length) {
      // Only the delivery that saw a refund succeed sends it on; the hourly
      // sweep catches one this misses.
      const { orderId } = outcome;
      after(() => pushOrderRefundsToThintent(orderId, "stripe"));
    }
    return Response.json({ received: true, result: outcome.result });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return Response.json({ received: true });
  }

  const session = summariseSession(event.data.object);
  if (!session.paid || !session.orderId) return Response.json({ received: true });

  const orderId = session.orderId;
  const result = await finaliseOrder(orderId, {
    sessionId: session.sessionId,
    paymentIntentId: session.paymentIntentId,
    amountTotal: session.amountTotal,
  });
  if (result === "not-found") {
    console.error(`Stripe webhook: session ${session.sessionId} names unknown order ${orderId}`);
  } else if (result === "finalised") {
    const origins = { site: resolveRequestOrigin(request), render: renderOrigin(request) };
    after(() => runPostPaymentSideEffects(orderId, origins));
  }
  return Response.json({ received: true, result });
}
