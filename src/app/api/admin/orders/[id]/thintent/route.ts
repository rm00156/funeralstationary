import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";
import {
  getThintentJobRef,
  isThintentConfigured,
  pushOrderRefundsToThintent,
  pushOrderToThintent,
} from "@/lib/thintent.server";

export const runtime = "nodejs";

/**
 * POST /api/admin/orders/:id/thintent — send (or re-send) the order to
 * Thintent by hand, for one the automatic send after payment couldn't
 * deliver; once the order has its job, send the refunds Thintent hasn't
 * recorded instead (a refunded order isn't re-sent as an order). Safe to
 * repeat: Thintent answers a repeat with the job or credit note it made.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/orders/[id]/thintent">) {
  if (!(await isAdmin())) return unauthorised();
  if (!isThintentConfigured()) {
    return Response.json({ error: "Thintent is not configured" }, { status: 503 });
  }
  const { id } = await ctx.params;

  const job = await getThintentJobRef(id);
  if (job === undefined) return Response.json({ error: "Order not found" }, { status: 404 });
  if (job) {
    const refunds = await pushOrderRefundsToThintent(id, "admin");
    if (refunds.errors.length) return Response.json({ error: refunds.errors.join("; ") }, { status: 502 });
    return Response.json({ ok: true, refundsSent: refunds.sent });
  }

  const result = await pushOrderToThintent(id, resolveRequestOrigin(request), "admin");
  if (!result.ok) {
    const status = result.error === "Order not found" ? 404 : 502;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result);
}
