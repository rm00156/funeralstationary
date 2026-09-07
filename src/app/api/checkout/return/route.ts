import { after, type NextRequest } from "next/server";
import { redirect } from "next/navigation";

import { runPostPaymentSideEffects } from "@/lib/orderFulfilment.server";
import { finaliseOrder } from "@/lib/orders.server";
import { isStripeConfigured, retrieveCheckoutSession } from "@/lib/stripe.server";

export const runtime = "nodejs";
// Post-payment side effects (Chromium proofs, email) run in after() and get
// this route's budget, so it needs the same headroom as /api/proof.
export const maxDuration = 60;

/**
 * GET /api/checkout/return?session_id=… — Stripe's success_url.
 *
 * Finalises the order here as well as in the webhook, so a local dev setup
 * with no webhook forwarding still completes orders, and the customer never
 * lands on a confirmation page that says "draft". finaliseOrder is an atomic
 * conditional update, so whichever of the two arrives second is a no-op.
 * A Route Handler rather than the page itself: finalising an order is a
 * side effect, and those don't belong in a Server Component render.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!isStripeConfigured() || !sessionId) redirect("/cart");

  const session = await retrieveCheckoutSession(sessionId);
  if (!session.orderId) redirect("/cart");
  if (!session.paid) redirect("/checkout?cancelled=1");

  const orderId = session.orderId;
  const result = await finaliseOrder(orderId, {
    sessionId: session.sessionId,
    paymentIntentId: session.paymentIntentId,
    amountTotal: session.amountTotal,
  });
  if (result === "not-found") redirect("/cart");
  if (result === "finalised") {
    const origin = new URL(request.url).origin;
    after(() => runPostPaymentSideEffects(orderId, origin));
  }
  redirect(`/orders/${orderId}?placed=1`);
}
