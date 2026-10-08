import type { NextRequest } from "next/server";

import { parseServiceDate } from "@/lib/artwork";
import { parseCheckoutDetails } from "@/lib/checkoutValidation";
import { cartErrorResponse, getCart, setCheckoutDetails } from "@/lib/orders.server";
import { getOrCreateOwner, readOwner } from "@/lib/session";
import { isShopOpen, shopClosedResponse } from "@/lib/siteBilling.server";

export const runtime = "nodejs";

/**
 * GET /api/cart — the caller's basket, or null. Read-only on purpose: the
 * header badge calls this on every page, and it must never mint a guest
 * cookie for a visitor who has done nothing.
 */
export async function GET() {
  const owner = await readOwner();
  const cart = owner ? await getCart(owner) : null;
  return Response.json({ cart });
}

/**
 * PATCH /api/cart — the order-level choice: checkout details, and with them
 * optionally the date of the funeral. Delivery is per line and goes through
 * PATCH /api/cart/items/:itemId.
 */
export async function PATCH(request: NextRequest) {
  if (!(await isShopOpen())) return shopClosedResponse();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { details, serviceDate: rawServiceDate } = (body ?? {}) as Record<string, unknown>;

  const owner = await getOrCreateOwner();
  try {
    let cart = null;
    if (details !== undefined) {
      const parsed = parseCheckoutDetails(details);
      if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
      // The funeral date is optional; left out of the body, the lines keep theirs.
      const serviceDate = rawServiceDate === undefined ? undefined : parseServiceDate(rawServiceDate);
      if (serviceDate && !serviceDate.ok) return Response.json({ error: serviceDate.error }, { status: 400 });
      cart = await setCheckoutDetails(owner, parsed.value, serviceDate?.date);
    }
    if (!cart) cart = await getCart(owner);
    return Response.json({ cart });
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
