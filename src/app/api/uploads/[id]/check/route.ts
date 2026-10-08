import type { NextRequest } from "next/server";

import { clientKey, createRateLimiter } from "@/lib/rateLimit";
import { getOrCreateOwner } from "@/lib/session";
import { checkUpload, uploadErrorResponse } from "@/lib/uploads.server";
import { isShopOpen, shopClosedResponse } from "@/lib/siteBilling.server";

export const runtime = "nodejs";
/** The first check downloads and parses a file of up to MAX_ARTWORK_BYTES. */
export const maxDuration = 60;

/** Checks per IP. Only the first per upload reads the file; the rest are cheap. */
const checks = createRateLimiter({ limit: 60, windowMs: 10 * 60_000 });

/**
 * POST /api/uploads/:id/check — "Check my file". Body `{ product, pages }`,
 * the step-1 choice; answers `{ report }`, the checks to show (see
 * evaluateArtwork). Re-checking against another choice reuses the stored
 * analysis rather than reading the file again.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/uploads/[id]/check">) {
  if (!(await isShopOpen())) return shopClosedResponse();
  if (!checks.hit(clientKey(request.headers))) {
    return Response.json({ error: "Too many checks — please wait a few minutes and try again." }, { status: 429 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { product, pages } = (body ?? {}) as Record<string, unknown>;

  const owner = await getOrCreateOwner();
  try {
    const report = await checkUpload(owner, id, { product, pages });
    return Response.json({ report });
  } catch (error) {
    const response = uploadErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
