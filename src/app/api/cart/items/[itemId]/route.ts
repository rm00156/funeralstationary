import type { NextRequest } from "next/server";

import { cartErrorResponse, removeCartItem, updateCartItem } from "@/lib/orders.server";
import { getOrCreateOwner } from "@/lib/session";

export const runtime = "nodejs";

const optionalSlug = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

/** PATCH /api/cart/items/:itemId — change a line's quantity/size/colour. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/cart/items/[itemId]">) {
  const { itemId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { quantity, size, colour } = (body ?? {}) as Record<string, unknown>;

  const owner = await getOrCreateOwner();
  try {
    const cart = await updateCartItem(owner, itemId, {
      quantity: optionalSlug(quantity),
      size: optionalSlug(size),
      colour: optionalSlug(colour),
    });
    return Response.json({ cart });
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/** DELETE /api/cart/items/:itemId — take a line out of the basket. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/cart/items/[itemId]">) {
  const { itemId } = await ctx.params;
  const owner = await getOrCreateOwner();
  try {
    const cart = await removeCartItem(owner, itemId);
    return Response.json({ cart });
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
