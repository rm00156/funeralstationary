/**
 * Stripe Checkout (hosted). The client is built lazily so `next build` and
 * CI — which run with no STRIPE_* env — never construct it; with
 * STRIPE_SECRET_KEY unset the checkout route answers 503, like /api/assets
 * does without S3.
 *
 * Amounts: one Stripe line per order line (unit price x copies) plus a
 * delivery line, built by the pure buildStripeLineItems so the sum is
 * exactly orders.total_pence — asserted here before a session is created.
 */
import Stripe from "stripe";

import { buildStripeLineItems, sumLineItems } from "@/lib/orders";
import type { FrozenOrder } from "@/lib/orders.server";

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | undefined;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY (see .env.example).");
  if (!client) client = new Stripe(key);
  return client;
}

/**
 * Send a frozen order to Stripe. The order id rides in metadata (and
 * client_reference_id) so the webhook / return route can find the order
 * from the session alone — never the other way round, since a double-clicked
 * Pay button creates two sessions for one order.
 */
export async function createCheckoutSessionForOrder(
  order: FrozenOrder,
  origin: string,
): Promise<{ id: string; url: string }> {
  const lines = buildStripeLineItems(order.items, order.delivery);
  const charged = sumLineItems(lines);
  if (charged !== order.totals.totalPence) {
    throw new Error(
      `Stripe line items sum to ${charged}p but order ${order.orderNumber} totals ${order.totals.totalPence}p`,
    );
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: "gbp",
        unit_amount: line.unitAmountPence,
        product_data: { name: line.name },
      },
    })),
    customer_email: order.contactEmail,
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
    payment_intent_data: {
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      description: `The Funeral Stationery order ${order.orderNumber}`,
    },
    success_url: `${origin}/api/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?cancelled=1`,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return { id: session.id, url: session.url };
}

/** What finaliseOrder needs from a session, however it reached us. */
export interface PaidSession {
  sessionId: string;
  orderId: string | null;
  paid: boolean;
  paymentIntentId: string | null;
  amountTotal: number | null;
}

export function summariseSession(session: Stripe.Checkout.Session): PaidSession {
  return {
    sessionId: session.id,
    orderId: session.metadata?.orderId ?? session.client_reference_id ?? null,
    paid: session.payment_status === "paid",
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    amountTotal: session.amount_total,
  };
}

export async function retrieveCheckoutSession(sessionId: string): Promise<PaidSession> {
  return summariseSession(await getStripe().checkout.sessions.retrieve(sessionId));
}

/** Verify a webhook delivery's signature; throws on a bad or missing one. */
export function constructWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
