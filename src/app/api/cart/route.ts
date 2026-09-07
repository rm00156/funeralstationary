import type { NextRequest } from "next/server";

import { parseCheckoutDetails } from "@/lib/checkoutValidation";
import {
  cartErrorResponse,
  getCart,
  setCartDelivery,
  setCheckoutDetails,
} from "@/lib/orders.server";
import { getOrCreateOwner, readOwner } from "@/lib/session";

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

/** PATCH /api/cart — order-level choices: delivery option and/or checkout details. */
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { delivery, details } = (body ?? {}) as Record<string, unknown>;

  const owner = await getOrCreateOwner();
  try {
    let cart = null;
    if (delivery !== undefined) {
      if (typeof delivery !== "string") {
        return Response.json({ error: "Invalid delivery option" }, { status: 400 });
      }
      cart = await setCartDelivery(owner, delivery);
    }
    if (details !== undefined) {
      const parsed = parseCheckoutDetails(details);
      if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
      cart = await setCheckoutDetails(owner, parsed.value);
    }
    if (!cart) cart = await getCart(owner);
    return Response.json({ cart });
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
