import { after, type NextRequest } from "next/server";

import { freezeCheckout } from "@/lib/checkout.server";
import { renderOrigin } from "@/lib/headlessBrowser.server";
import { runPostPaymentSideEffects } from "@/lib/orderFulfilment.server";
import { placeOrderOnAccount } from "@/lib/orders.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";
// The post-order side effects (Chromium proofs, email, Thintent) run in
// after() and get this route's budget, like /api/checkout/return.
export const maxDuration = 60;

/**
 * POST /api/checkout/account — "Place order on account", for a trade firm an
 * admin allowed to (trade_firms.on_account; trade.ts resolvePayWith refuses
 * anyone else). The same checks and freeze as the card route, then the order
 * goes to print unpaid and Thintent is sent it with the firm's terms, to
 * invoice (thintent.ts). Answers the order page to go to.
 */
export async function POST(request: NextRequest) {
  const frozen = await freezeCheckout(request, "account");
  if (!frozen.ok) return frozen.response;
  const { membership, order } = frozen;
  if (!membership?.onAccount || membership.paymentTermsDays === null) {
    return Response.json({ error: "This account can't order on account. Please pay by card." }, { status: 400 });
  }

  const result = await placeOrderOnAccount(order.id, {
    firmName: membership.firmName,
    paymentTermsDays: membership.paymentTermsDays,
    accountsEmail: membership.accountsEmail,
  });
  if (result === "not-found") return Response.json({ error: "Your basket is empty" }, { status: 400 });
  if (result === "finalised") {
    const origins = { site: resolveRequestOrigin(request), render: renderOrigin(request) };
    after(() => runPostPaymentSideEffects(order.id, origins));
  }
  return Response.json({ url: `/orders/${order.id}?placed=1` });
}
