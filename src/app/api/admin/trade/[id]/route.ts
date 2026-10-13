import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import { parseTradeFirmInput, parseTradeId } from "@/lib/trade";
import { TradeAdminError, updateTradeFirm } from "@/lib/trade.server";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/trade/:id { name, paymentTermsDays, isActive } — edit a
 * firm. Retiring it (isActive false) turns its people's trade view off at
 * once; firms are never deleted, since orders point at them.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/trade/[id]">) {
  if (!(await isAdmin())) return unauthorised();
  const id = parseTradeId((await ctx.params).id);
  if (!id) return Response.json({ error: "That firm no longer exists." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseTradeFirmInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { isActive } = (body ?? {}) as Record<string, unknown>;
  if (typeof isActive !== "boolean") {
    return Response.json({ error: "Say whether the firm is active." }, { status: 400 });
  }
  try {
    await updateTradeFirm(id, { ...parsed.value, isActive });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TradeAdminError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
