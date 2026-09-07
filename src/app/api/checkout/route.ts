import type { NextRequest } from "next/server";

import { parseCheckoutDetails } from "@/lib/checkoutValidation";
import {
  attachCheckoutSession,
  cartErrorResponse,
  prepareOrderForPayment,
  setCheckoutDetails,
} from "@/lib/orders.server";
import { getOrCreateOwner } from "@/lib/session";
import { createCheckoutSessionForOrder, isStripeConfigured } from "@/lib/stripe.server";

export const runtime = "nodejs";

/**
 * POST /api/checkout — the Pay button. Saves the delivery details, freezes
 * the basket (server-side repricing + snapshots), creates a Stripe Checkout
 * Session and hands back its URL for the browser to navigate to.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const details = parseCheckoutDetails(body);
  if (!details.ok) return Response.json({ error: details.error }, { status: 400 });

  const owner = await getOrCreateOwner();
  try {
    await setCheckoutDetails(owner, details.value);
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const prepared = await prepareOrderForPayment(owner);
  if (!prepared.ok) {
    return Response.json(
      { error: prepared.error, itemId: prepared.itemId },
      { status: prepared.status },
    );
  }

  const origin = new URL(request.url).origin;
  const session = await createCheckoutSessionForOrder(prepared.order, origin);
  await attachCheckoutSession(prepared.order.id, session.id);
  return Response.json({ url: session.url });
}
