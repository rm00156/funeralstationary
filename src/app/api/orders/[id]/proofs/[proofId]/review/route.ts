import type { NextRequest } from "next/server";

import { parseProofDecision } from "@/lib/orders";
import { cartErrorResponse, recordProofReview } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";

export const runtime = "nodejs";

/** Long enough for "the middle initial is wrong on page 2", not an essay. */
const MAX_NOTE_LENGTH = 2000;

/**
 * POST /api/orders/:id/proofs/:proofId/review — the customer approves their
 * proof or asks for a change.
 *
 * readOwner rather than getOrCreateOwner: a caller with no cookie cannot own
 * an order, so minting one for them would only hand a cookie to a prober.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/orders/[id]/proofs/[proofId]/review">,
) {
  const { id, proofId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { decision: rawDecision, note: rawNote } = (body ?? {}) as Record<string, unknown>;

  const decision = parseProofDecision(rawDecision);
  if (!decision) {
    return Response.json(
      { error: 'decision must be "approved" or "changes_requested"' },
      { status: 400 },
    );
  }

  const note = typeof rawNote === "string" ? rawNote.trim() : "";
  if (note.length > MAX_NOTE_LENGTH) {
    return Response.json({ error: "That note is too long" }, { status: 400 });
  }
  if (decision === "changes_requested" && !note) {
    return Response.json(
      { error: "Please tell us what needs changing" },
      { status: 400 },
    );
  }

  const owner = await readOwner();
  if (!owner) return Response.json({ error: "Order not found" }, { status: 404 });

  try {
    const order = await recordProofReview(owner, id, proofId, decision, note || null);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    return Response.json({ order });
  } catch (error) {
    const response = cartErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
