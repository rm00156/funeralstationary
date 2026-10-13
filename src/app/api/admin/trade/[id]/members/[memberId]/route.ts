import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import { parseTradeId } from "@/lib/trade";
import { TradeAdminError, removeTradeMember } from "@/lib/trade.server";

export const runtime = "nodejs";

/** DELETE /api/admin/trade/:id/members/:memberId — take someone off a firm. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/trade/[id]/members/[memberId]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const params = await ctx.params;
  const firmId = parseTradeId(params.id);
  const memberId = parseTradeId(params.memberId);
  if (!firmId || !memberId) {
    return Response.json({ error: "That person is no longer on this firm." }, { status: 404 });
  }
  try {
    await removeTradeMember(firmId, memberId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TradeAdminError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
