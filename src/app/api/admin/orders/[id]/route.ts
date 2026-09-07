import type { NextRequest } from "next/server";

import { adminUpdateOrderStatus, OrderTransitionError } from "@/lib/adminOrders.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseNote } from "@/lib/adminValidation";
import { parseOrderStatus } from "@/lib/orders";

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
    const order = await adminUpdateOrderStatus(id, nextStatus, parsedNote ?? null);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    return Response.json({ order });
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
