import type { NextRequest } from "next/server";

import { canSendReviewRequests, sendDueReviewRequests } from "@/lib/reviewRequests.server";
import { resolveRequestOrigin } from "@/lib/stripe.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/review-requests — Vercel Cron, weekday mornings
 * (vercel.json). Sends the one "how did we do" email to each completed order
 * whose time has come (src/lib/reviewRequest.ts). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!canSendReviewRequests()) {
    return Response.json({ skipped: "Email or AUTH_SECRET is not configured" });
  }
  return Response.json(await sendDueReviewRequests(resolveRequestOrigin(request)));
}
