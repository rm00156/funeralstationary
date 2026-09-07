import type { NextRequest } from "next/server";

import { ensureShareToken, revokeShareToken } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";

export const runtime = "nodejs";

const notFound = () => Response.json({ error: "Order not found" }, { status: 404 });

/**
 * POST /api/orders/:id/share — mint (or re-read) the read-only link the
 * customer can forward to family. readOwner rather than getOrCreateOwner:
 * a caller with no cookie cannot own an order.
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/orders/[id]/share">) {
  const { id } = await ctx.params;
  const owner = await readOwner();
  if (!owner) return notFound();

  const token = await ensureShareToken(owner, id);
  if (!token) return notFound();
  return Response.json({ token });
}

/** DELETE /api/orders/:id/share — kill a link that has travelled too far. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/orders/[id]/share">) {
  const { id } = await ctx.params;
  const owner = await readOwner();
  if (!owner) return notFound();

  const revoked = await revokeShareToken(owner, id);
  if (!revoked) return notFound();
  return Response.json({ token: null });
}
