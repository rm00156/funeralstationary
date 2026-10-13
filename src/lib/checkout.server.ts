import type { NextRequest } from "next/server";

import { parseServiceDate } from "@/lib/artwork";
import { parseCheckoutDetails, parseReviewOptOut } from "@/lib/checkoutValidation";
import {
  cartErrorResponse,
  prepareOrderForPayment,
  setCheckoutDetails,
  type FrozenOrder,
} from "@/lib/orders.server";
import { getOrCreateOwner, type Owner } from "@/lib/session";
import { isShopOpen, shopClosedResponse } from "@/lib/siteBilling.server";
import { isStripeConfigured } from "@/lib/stripe.server";
import { parseTradeOrderDetails, resolvePayWith, type PayWith, type TradeMembership } from "@/lib/trade";
import { getCurrentTradeMembership } from "@/lib/trade.server";

export type FrozenCheckout =
  | { ok: false; response: Response }
  | { ok: true; owner: Owner; membership: TradeMembership | null; order: FrozenOrder };

const fail = (error: string, status: number, extra: Record<string, unknown> = {}): FrozenCheckout => ({
  ok: false,
  response: Response.json({ error, ...extra }, { status }),
});

/**
 * Everything the two ways to pay share, up to the moment money is asked
 * for: the checkout form's fields are checked and saved (with, for a trade
 * account, the family's name and the firm's reference), then the basket is
 * repriced and frozen (prepareOrderForPayment). POST /api/checkout then
 * sends the customer to Stripe; POST /api/checkout/account places the
 * order on account. Kept apart from both routes so the card route stays
 * free of the Chromium and mail modules the account route needs.
 */
export async function freezeCheckout(request: NextRequest, payWith: PayWith): Promise<FrozenCheckout> {
  if (!(await isShopOpen())) return { ok: false, response: shopClosedResponse() };
  if (payWith === "card" && !isStripeConfigured()) return fail("Payments are not configured yet", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  const details = parseCheckoutDetails(body);
  if (!details.ok) return fail(details.error, 400);
  // The funeral date is optional; a body without the field (an older form
  // still open in a tab) leaves the dates the lines already carry.
  const raw = (body ?? {}) as Record<string, unknown>;
  const serviceDate = raw.serviceDate === undefined ? undefined : parseServiceDate(raw.serviceDate);
  if (serviceDate && !serviceDate.ok) return fail(serviceDate.error, 400);
  const reviewOptOut = parseReviewOptOut(raw.reviewOptOut);
  if (!reviewOptOut.ok) return fail(reviewOptOut.error, 400);

  const owner = await getOrCreateOwner();
  // A trade account names the family and its own reference; anyone else's
  // order carries neither (null clears what an earlier attempt saved).
  const membership = owner.userId ? await getCurrentTradeMembership() : null;
  const allowed = resolvePayWith(payWith, membership);
  if (!allowed.ok) return fail(allowed.error, 400);
  let trade = null;
  if (membership) {
    const parsed = parseTradeOrderDetails(body);
    if (!parsed.ok) return fail(parsed.error, 400);
    trade = { firmId: membership.firmId, ...parsed.value };
  }

  try {
    await setCheckoutDetails(owner, details.value, serviceDate?.date, reviewOptOut.value, trade);
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return { ok: false, response };
    throw error;
  }

  const prepared = await prepareOrderForPayment(owner);
  if (!prepared.ok) return fail(prepared.error, prepared.status, { itemId: prepared.itemId });
  return { ok: true, owner, membership, order: prepared.order };
}
