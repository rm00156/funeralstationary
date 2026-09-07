import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminSession";
import { generateOrderItemPrintPdf } from "@/lib/orderFulfilment.server";
import { isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
// Headless Chromium — same budget as /api/proof.
export const maxDuration = 60;

/**
 * POST /api/admin/orders/:id/proofs/:proofId/pdf — render the press file for
 * one proof version. On demand rather than at payment: it is expensive, only
 * the press reads it, and it should be made from the artwork the customer
 * approved.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/orders/[id]/proofs/[proofId]/pdf">,
) {
  if (!(await isAdmin())) return unauthorised();
  if (!isStorageConfigured()) {
    return Response.json(
      { error: "Object storage is not configured — proofs cannot be stored" },
      { status: 503 },
    );
  }
  const { id, proofId } = await ctx.params;

  try {
    const pdf = await generateOrderItemPrintPdf(id, proofId, new URL(request.url).origin);
    return Response.json({ pdf }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("not found")) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
