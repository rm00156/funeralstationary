import type { NextRequest } from "next/server";

import { adminGetOrder, adminUpdateOrderStatus, OrderTransitionError } from "@/lib/adminOrders.server";
import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import { parseNote } from "@/lib/adminValidation";
import { parseOrderStatus } from "@/lib/orders";
import { settleRefundedStatus } from "@/lib/refunds.server";

export const runtime = "nodejs";

/** PATCH /api/admin/orders/:id — move the order to a new status, with an optional note. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/orders/[id]">) {
  if (!(await isAdmin())) return unauthorised();
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { status, note } = (body ?? {}) as Record<string, unknown>;

  const nextStatus = parseOrderStatus(status);
  if (!nextStatus) return Response.json({ error: "Invalid status" }, { status: 400 });
  const parsedNote = parseNote(note);
  if (parsedNote === undefined && note !== undefined) {
    return Response.json({ error: "Invalid note" }, { status: 400 });
  }

  try {
    const moved = await adminUpdateOrderStatus(id, nextStatus, parsedNote ?? null);
    if (!moved) return Response.json({ error: "Order not found" }, { status: 404 });
    // A refund made earlier settles once the order reaches a status it can
    // (cancelled, delivered) — the Stripe event that recorded it came first.
    await settleRefundedStatus(id);
    return Response.json({ order: (await adminGetOrder(id)) ?? moved });
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
