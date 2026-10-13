import type { NextRequest } from "next/server";

import { freezeCheckout } from "@/lib/checkout.server";
import { attachCheckoutSession } from "@/lib/orders.server";
import { createCheckoutSessionForOrder, resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";

/**
 * POST /api/checkout — the Pay button. Saves the delivery details (and, for
 * a trade account, the family's name and the firm's reference), freezes
 * the basket (server-side repricing + snapshots — checkout.server.ts),
 * creates a Stripe Checkout Session and hands back its URL for the browser
 * to navigate to. Placing an order on account is POST /api/checkout/account.
 */
export async function POST(request: NextRequest) {
  const frozen = await freezeCheckout(request, "card");
  if (!frozen.ok) return frozen.response;

  const session = await createCheckoutSessionForOrder(frozen.order, resolveRequestOrigin(request));
  await attachCheckoutSession(frozen.order.id, session.id);
  return Response.json({ url: session.url });
}
