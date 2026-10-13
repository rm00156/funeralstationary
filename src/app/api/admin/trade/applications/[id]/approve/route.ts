import type { NextRequest } from "next/server";

import { getCurrentAdmin, unauthorised } from "@/lib/adminAuth.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";
import { isTradeApplicationId, parseTradeApproval } from "@/lib/trade";
import { TradeAdminError, approveTradeApplication } from "@/lib/trade.server";

export const runtime = "nodejs";

/**
 * POST /api/admin/trade/applications/:id/approve
 * { kind: "new", name, paymentTermsDays } | { kind: "existing", firmId }
 * — make the applicant a trade account and email them that it's ready.
 * Answers how the email went, so the page can say when to pass it on by hand.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/trade/applications/[id]/approve">) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorised();
  const { id } = await ctx.params;
  if (!isTradeApplicationId(id)) {
    return Response.json({ error: "That application no longer exists." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const approval = parseTradeApproval(body);
  if (!approval.ok) return Response.json({ error: approval.error }, { status: 400 });
  try {
    const result = await approveTradeApplication(id, approval.value, admin.email, resolveRequestOrigin(request));
    return Response.json(result);
  } catch (error) {
    if (error instanceof TradeAdminError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
