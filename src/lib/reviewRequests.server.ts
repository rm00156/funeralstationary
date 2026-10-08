/**
 * The review-request seam: finds completed orders whose one "how did we do"
 * email has fallen due (src/lib/reviewRequest.ts decides) and sends it, and
 * records the addresses that ask for no more. Run daily by
 * GET /api/cron/review-requests.
 *
 * Its own module, beside orderFulfilment.server.ts rather than in
 * orders.server.ts, so the basket and checkout routes never trace the mail
 * client into their bundles. Best-effort like the rest of fulfilment: a
 * failed send is an order event and is retried on the next run.
 */
import { and, eq, gte, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orderRefunds, orders, reviewRequestOptOuts } from "@/db/schema";
import { shopDate } from "@/lib/adminDashboard";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import { reviewRequestEmail } from "@/lib/orderEmails";
import { refundedPence } from "@/lib/orders";
import { addOrderEvent } from "@/lib/orders.server";
import { reviewOptOutToken, reviewRequestDecision } from "@/lib/reviewRequest";
import { GOOGLE_REVIEWS } from "@/lib/site";
import { authSecret } from "@/lib/userSession";

/**
 * How far back to look for completed orders. Comfortably past the latest a
 * request can fall due (completion + 21 days + the 14-day window); a
 * funeral dated months after its stationery was finished is simply not asked.
 */
const LOOKBACK_DAYS = 120;

export function canSendReviewRequests(): boolean {
  // The unsubscribe link is signed; without a secret there is no way to say no.
  return isEmailConfigured() && authSecret() !== null;
}

export interface ReviewRequestRun {
  considered: number;
  sent: number;
  failed: number;
}

/**
 * Stop starting sends this long into a run, well inside the cron route's
 * 60s maxDuration: a send killed mid-flight would leave its order claimed
 * with no email. What's left goes on the next weekday run, within its window.
 */
const RUN_BUDGET_MS = 40_000;

/** Send every request due today. One at a time — a handful a day at most. */
export async function sendDueReviewRequests(siteOrigin: string, now = new Date()): Promise<ReviewRequestRun> {
  const secret = authSecret();
  if (!isEmailConfigured() || !secret) return { considered: 0, sent: 0, failed: 0 };
  const startedAt = Date.now();

  // From the delivered orders (indexed on status), not from order_events,
  // which has no index on to_status and grows with every event.
  const candidates = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      contactName: orders.contactName,
      contactEmail: orders.contactEmail,
      optOut: orders.reviewRequestOptOut,
      requestedAt: orders.reviewRequestedAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "delivered"),
        eq(orders.reviewRequestOptOut, false),
        isNull(orders.reviewRequestedAt),
      ),
    );
  if (!candidates.length) return { considered: 0, sent: 0, failed: 0 };

  const ids = candidates.map((order) => order.id);
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const emails = [...new Set(candidates.flatMap((order) => (order.contactEmail ? [order.contactEmail.toLowerCase()] : [])))];
  const [completions, items, refunds, optedOut] = await Promise.all([
    db
      .select({ orderId: orderEvents.orderId, createdAt: orderEvents.createdAt })
      .from(orderEvents)
      .where(and(inArray(orderEvents.orderId, ids), eq(orderEvents.toStatus, "delivered"), gte(orderEvents.createdAt, since))),
    db.select({ orderId: orderItems.orderId, serviceDate: orderItems.serviceDate }).from(orderItems).where(inArray(orderItems.orderId, ids)),
    db
      .select({ orderId: orderRefunds.orderId, amountPence: orderRefunds.amountPence, status: orderRefunds.status })
      .from(orderRefunds)
      .where(inArray(orderRefunds.orderId, ids)),
    emails.length
      ? db.select({ email: reviewRequestOptOuts.email }).from(reviewRequestOptOuts).where(inArray(reviewRequestOptOuts.email, emails))
      : Promise.resolve([]),
  ]);
  // The latest move to delivered, should an order have made it twice.
  const completedAt = new Map<string, Date>();
  for (const row of completions) {
    const seen = completedAt.get(row.orderId);
    if (!seen || row.createdAt > seen) completedAt.set(row.orderId, row.createdAt);
  }
  const optedOutEmails = new Set(optedOut.map((row) => row.email));

  const today = shopDate(now);
  const run: ReviewRequestRun = { considered: candidates.length, sent: 0, failed: 0 };
  for (const order of candidates) {
    const completed = completedAt.get(order.id);
    // Completed before the lookback: too late to ask.
    if (!completed) continue;
    const email = order.contactEmail?.toLowerCase() ?? null;
    const decision = reviewRequestDecision(
      {
        status: order.status,
        optOut: order.optOut,
        emailOptedOut: !!email && optedOutEmails.has(email),
        contactEmail: email,
        requestedAt: order.requestedAt,
        refunded: refundedPence(refunds.filter((refund) => refund.orderId === order.id)) > 0,
        completedOn: shopDate(completed),
        serviceDates: items.filter((item) => item.orderId === order.id).map((item) => item.serviceDate),
      },
      today,
    );
    if (decision.action !== "send" || !email) continue;
    if (Date.now() - startedAt > RUN_BUDGET_MS) break;
    if (await sendReviewRequest(order, email, siteOrigin, secret)) run.sent += 1;
    else run.failed += 1;
  }
  return run;
}

async function sendReviewRequest(
  order: { id: string; orderNumber: string; contactName: string | null },
  email: string,
  siteOrigin: string,
  secret: string,
): Promise<boolean> {
  // Claim first: of two overlapping runs only one sends.
  const [claim] = await db
    .update(orders)
    .set({ reviewRequestedAt: new Date() })
    .where(and(eq(orders.id, order.id), isNull(orders.reviewRequestedAt), eq(orders.status, "delivered")));
  if (claim.affectedRows === 0) return false;

  const token = encodeURIComponent(reviewOptOutToken(email, secret));
  let failure: unknown = null;
  try {
    const sent = await sendEmail({
      to: email,
      ...reviewRequestEmail({
        contactName: order.contactName ?? "there",
        reviewUrl: GOOGLE_REVIEWS.writeReviewUrl,
        optOutUrl: `${siteOrigin}/email/unsubscribe?t=${token}`,
        oneClickUrl: `${siteOrigin}/api/email/unsubscribe?t=${token}`,
      }),
    });
    if (!sent) failure = new Error("Email is not configured");
  } catch (error) {
    failure = error;
  }

  if (failure) {
    console.error(`Review request failed for order ${order.orderNumber}`, failure);
    // Nothing went out: release the claim so the next run tries again, within the window.
    await db.update(orders).set({ reviewRequestedAt: null }).where(eq(orders.id, order.id)).catch(() => undefined);
    await addOrderEvent(order.id, {
      type: "email_failed",
      note: `review request: ${failure instanceof Error ? failure.message : String(failure)}`,
    }).catch(() => undefined);
    return false;
  }
  // The email went: the claim stands even if the event can't be written, or
  // the family would be asked twice.
  await addOrderEvent(order.id, { type: "review_requested", note: `Review request sent to ${email}` }).catch((error) =>
    console.error(`Review request sent for order ${order.orderNumber}, but its event wasn't recorded`, error),
  );
  return true;
}

/** Record an address that asked for no more. Idempotent. */
export async function optOutOfReviewRequests(email: string): Promise<void> {
  await db
    .insert(reviewRequestOptOuts)
    .values({ email: email.toLowerCase() })
    .onDuplicateKeyUpdate({ set: { email: email.toLowerCase() } });
}
