import type { NextRequest } from "next/server";

import { getCurrentAdmin, unauthorised } from "@/lib/adminAuth.server";
import { isTradeApplicationId, parseDecisionNote } from "@/lib/trade";
import { TradeAdminError, declineTradeApplication } from "@/lib/trade.server";

export const runtime = "nodejs";

/**
 * POST /api/admin/trade/applications/:id/decline { note } — turn an
 * application down. Nothing is emailed; the note is for staff.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/trade/applications/[id]/decline">) {
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
  const note = parseDecisionNote((body as Record<string, unknown> | null)?.note);
  if (!note.ok) return Response.json({ error: note.error }, { status: 400 });
  try {
    await declineTradeApplication(id, note.value, admin.email);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TradeAdminError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
