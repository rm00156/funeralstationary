import { after, type NextRequest } from "next/server";

import { adminUpdateOrderStatus, OrderTransitionError } from "@/lib/adminOrders.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseNote } from "@/lib/adminValidation";
import { sendProofReadyEmail } from "@/lib/orderFulfilment.server";
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
    // Releasing the proof is the moment the customer needs telling; the
    // send is best-effort and must not hold up the admin's response.
    if (nextStatus === "proof_sent") {
      const origin = new URL(request.url).origin;
      after(() => sendProofReadyEmail(id, origin));
    }
    return Response.json({ order });
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
