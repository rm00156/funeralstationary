import type { NextRequest } from "next/server";

import { resolveRequestOrigin } from "@/lib/stripe.server";
import {
  isThintentConfigured,
  listOrdersAwaitingThintent,
  listOrdersWithRefundsAwaitingThintent,
  pushOrderRefundsToThintent,
  pushOrderToThintent,
} from "@/lib/thintent.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/thintent-sync — Vercel Cron, hourly (vercel.json). Re-sends
 * the past week's paid orders that never reached Thintent, then the refunds
 * Thintent hasn't recorded, so an outage there can't quietly leave either
 * out of the one place the shop works from. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!isThintentConfigured()) return Response.json({ skipped: "Thintent is not configured" });

  const origin = resolveRequestOrigin(request);
  const ids = await listOrdersAwaitingThintent();
  let sent = 0;
  // One at a time: a handful an hour at most, and Thintent rate-limits.
  for (const id of ids) {
    if ((await pushOrderToThintent(id, origin, "cron")).ok) sent += 1;
  }

  // After the orders: a job made just now carries its refunds over itself.
  const refundOrders = await listOrdersWithRefundsAwaitingThintent();
  let refundsSent = 0;
  for (const id of refundOrders) {
    refundsSent += (await pushOrderRefundsToThintent(id, "cron")).sent;
  }
  return Response.json({ pending: ids.length, sent, refundOrders: refundOrders.length, refundsSent });
}
