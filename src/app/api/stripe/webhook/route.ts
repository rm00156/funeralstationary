import { after, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { runPostPaymentSideEffects } from "@/lib/orderFulfilment.server";
import { finaliseOrder } from "@/lib/orders.server";
import { constructWebhookEvent, summariseSession } from "@/lib/stripe.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/stripe/webhook — Stripe's delivery of Checkout events.
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
    const origin = new URL(request.url).origin;
    after(() => runPostPaymentSideEffects(orderId, origin));
  }
  return Response.json({ received: true, result });
}
