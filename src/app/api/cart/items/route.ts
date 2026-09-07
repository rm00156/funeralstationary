import type { NextRequest } from "next/server";

import { addCartItem, cartErrorResponse } from "@/lib/orders.server";
import { getOrCreateOwner } from "@/lib/session";

export const runtime = "nodejs";

const optionalSlug = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

/**
 * POST /api/cart/items — add one of the caller's designs to the basket.
 * Idempotent per design. quantity/size/colour are optional slugs; pages and
 * paper always come from the design itself.
 *
 * This is the pre-order gate (see addCartItem): a design with an empty photo
 * window is refused, and one still carrying the template's wording is refused
 * until `acknowledgeDefaults` says the customer has been shown it and
 * confirmed. Both come back as 409s carrying a `readiness` report the client
 * renders — see src/lib/designReadiness.ts.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { designId, quantity, size, colour, acknowledgeDefaults } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (typeof designId !== "string" || !designId) {
    return Response.json({ error: "designId is required" }, { status: 400 });
  }

  const owner = await getOrCreateOwner();
  try {
    const cart = await addCartItem(owner, designId, {
      quantity: optionalSlug(quantity),
      size: optionalSlug(size),
      colour: optionalSlug(colour),
      acknowledgeDefaults: acknowledgeDefaults === true,
    });
    return Response.json({ cart }, { status: 201 });
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
