import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminSession";
import { generateOrderItemProof } from "@/lib/orderFulfilment.server";
import { isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
// Headless Chromium — same budget as /api/proof.
export const maxDuration = 60;

/** POST /api/admin/orders/:id/items/:itemId/proof — render the next proof version. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/orders/[id]/items/[itemId]/proof">,
) {
  if (!(await isAdmin())) return unauthorised();
  if (!isStorageConfigured()) {
    return Response.json(
      { error: "Object storage is not configured — proofs cannot be stored" },
      { status: 503 },
    );
  }
  const { id, itemId } = await ctx.params;

  try {
    const proof = await generateOrderItemProof(id, itemId, new URL(request.url).origin, "admin");
    return Response.json({ proof }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("not found")) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
