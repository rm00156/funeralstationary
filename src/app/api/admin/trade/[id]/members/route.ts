import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import { parseTradeId, parseTradeMemberInput } from "@/lib/trade";
import { TradeAdminError, addTradeMember } from "@/lib/trade.server";

export const runtime = "nodejs";

/**
 * POST /api/admin/trade/:id/members { email, name } — put someone on a firm.
 * Nothing is emailed: they sign in at /account as anyone does, and their
 * account shows the trade view from then on.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/trade/[id]/members">) {
  if (!(await isAdmin())) return unauthorised();
  const firmId = parseTradeId((await ctx.params).id);
  if (!firmId) return Response.json({ error: "That firm no longer exists." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseTradeMemberInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    await addTradeMember(firmId, parsed.value);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof TradeAdminError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
