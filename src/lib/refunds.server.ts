/**
 * Stripe refunds, mirrored onto orders. Money only ever moves in Stripe —
 * the dashboard today — and the Stripe webhook's refund events land here:
 * every refund on the payment is re-read from Stripe and upserted into
 * order_refunds, so a late, repeated or re-ordered event can't leave a stale
 * state. The pure rules (what counts, what a full refund does to the status)
 * are refundedPence / refundStatusEffect in orders.ts.
 *
 * Neither a cancel here nor one in Thintent creates a refund; this is the
 * only writer of order_refunds.
 */
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { isDuplicateKeyError } from "@/db/errors";
import { orderRefunds, orders } from "@/db/schema";
import { moveOrderStatus } from "@/lib/adminOrders.server";
import { formatPence } from "@/lib/orderOfServicePricing";
import { refundStatusEffect, refundedPence } from "@/lib/orders";
import { addOrderEvent, addOrderEventOnce } from "@/lib/orders.server";
import { listPaymentRefunds } from "@/lib/stripe.server";

export type RefundSyncOutcome =
  | { result: "unknown-order" }
  /** `succeeded`: Stripe refund ids that this call saw succeed for the first time. */
  | { result: "synced"; orderId: string; succeeded: string[] };

/**
 * Bring an order's refunds up to date with Stripe. Each refund's status
 * change is claimed with a conditional write (insert, or UPDATE … WHERE
 * status <> new), so of two overlapping deliveries only one records the
 * "refunded" event for it. Throws if Stripe can't be read — the webhook then
 * answers 500 and Stripe retries.
 */
export async function syncStripeRefunds(paymentIntentId: string): Promise<RefundSyncOutcome> {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (!order) return { result: "unknown-order" };

  const succeeded: string[] = [];
  for (const refund of await listPaymentRefunds(paymentIntentId)) {
    let changed: boolean;
    try {
      await db.insert(orderRefunds).values({ id: crypto.randomUUID(), orderId: order.id, ...refund });
      changed = true;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const [result] = await db
        .update(orderRefunds)
        .set({ amountPence: refund.amountPence, status: refund.status, reason: refund.reason })
        .where(and(eq(orderRefunds.stripeRefundId, refund.stripeRefundId), ne(orderRefunds.status, refund.status)));
      changed = result.affectedRows > 0;
    }
    if (!changed) continue;

    if (refund.status === "succeeded") {
      succeeded.push(refund.stripeRefundId);
      await addOrderEvent(order.id, {
        type: "refund_recorded",
        actor: "stripe",
        note: `${formatPence(refund.amountPence)} refunded in Stripe (${refund.stripeRefundId})`,
      });
    } else if (refund.status === "failed" || refund.status === "canceled") {
      await addOrderEvent(order.id, {
        type: "refund_failed",
        actor: "stripe",
        note: await refundFailedNote(order.id, refund),
      });
    }
  }

  await settleRefundedStatus(order.id);
  return { result: "synced", orderId: order.id, succeeded };
}

/**
 * A refund can fail after it succeeded (a closed card). Nothing here undoes
 * what its success did — Thintent has no way to take a credit note back, and
 * `refunded` is a final status — so the note tells staff what to put right.
 */
async function refundFailedNote(
  orderId: string,
  refund: { stripeRefundId: string; amountPence: number; status: string },
): Promise<string> {
  const [[row], [order]] = await Promise.all([
    db
      .select({ creditRef: orderRefunds.thintentCreditRef })
      .from(orderRefunds)
      .where(eq(orderRefunds.stripeRefundId, refund.stripeRefundId))
      .limit(1),
    db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).limit(1),
  ]);
  return [
    `A ${formatPence(refund.amountPence)} refund ${refund.status === "failed" ? "failed" : "was cancelled"} in Stripe (${refund.stripeRefundId}) — the customer has not been paid back.`,
    row?.creditRef ? `Thintent still shows it as credit note ${row.creditRef}: put that right there by hand.` : null,
    order?.status === "refunded" ? "This order still says Refunded." : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Move a fully refunded order to `refunded` when the status machine allows
 * it (cancelled, delivered). Called after a refund lands and after Thintent
 * moves the order, since either can be the one that completes the pair — a
 * refund made before the job was cancelled settles when the cancel arrives.
 *
 * A fully refunded order that is still going to print is not stopped here:
 * status changes in Thintent, so staff are told (once) to cancel it there.
 */
export async function settleRefundedStatus(orderId: string): Promise<void> {
  const [[order], refunds] = await Promise.all([
    db.select({ status: orders.status, totalPence: orders.totalPence }).from(orders).where(eq(orders.id, orderId)).limit(1),
    db
      .select({ amountPence: orderRefunds.amountPence, status: orderRefunds.status })
      .from(orderRefunds)
      .where(eq(orderRefunds.orderId, orderId)),
  ]);
  if (!order) return;
  const refunded = refundedPence(refunds);

  switch (refundStatusEffect(order.status, refunded, order.totalPence)) {
    case "refund":
      // A concurrent move wins; the next event settles it again.
      await moveOrderStatus(orderId, order.status, "refunded", `${formatPence(refunded)} refunded in Stripe`, "stripe");
      return;
    case "still-printing":
      await addOrderEventOnce(orderId, {
        type: "refund_still_printing",
        actor: "stripe",
        note: "Refunded in full, but the order is still going to print. If it shouldn't be printed, cancel the job in Thintent.",
      });
      return;
    case "none":
      return;
  }
}
