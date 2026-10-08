/**
 * Thintent sync, server half: send a paid order to the shop's Thintent
 * account as an already-paid job, and apply the job-status webhooks it sends
 * back. The pure payload/mapping/signature logic is thintent.ts.
 *
 * Best-effort like the other post-payment side effects: a failed send is an
 * order_events row (`thintent_failed`), never a failed order, and is retried
 * by the hourly sweep (/api/cron/thintent-sync) or the admin "Send to
 * Thintent" button. Sending twice is safe — Thintent keys the job on the
 * order number and answers a repeat with the job it already made.
 *
 * Unset THINTENT_API_URL / THINTENT_API_KEY → everything here is a silent
 * no-op, like storage and email.
 */
import { and, asc, desc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderRefunds, orders } from "@/db/schema";
import { formatPence } from "@/lib/orderOfServicePricing";
import { moveOrderStatus } from "@/lib/adminOrders.server";
import { getProductLabels } from "@/lib/catalogue.server";
import { addOrderEvent, addOrderEventOnce, loadOrderDetail } from "@/lib/orders.server";
import { settleRefundedStatus } from "@/lib/refunds.server";
import { isStripeConfigured, retrievePaymentFeePence } from "@/lib/stripe.server";
import {
  buildThintentOrderPayload,
  buildThintentRefundPayload,
  canSendToThintent,
  thintentStatusMoves,
  thintentTargetStatus,
  type ThintentJobEvent,
} from "@/lib/thintent";

export function isThintentConfigured(): boolean {
  return !!process.env.THINTENT_API_URL && !!process.env.THINTENT_API_KEY;
}

export type ThintentPushResult =
  | { ok: true; jobRef: string; jobUrl: string | null; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Send one paid order to Thintent and remember the job it became. Never
 * throws: the outcome is returned and written to the order's history.
 */
export async function pushOrderToThintent(
  orderId: string,
  siteOrigin: string,
  actor = "system",
): Promise<ThintentPushResult> {
  if (!isThintentConfigured()) return { ok: false, error: "Thintent is not configured" };

  let orderNumber = orderId;
  try {
    const order = await loadOrderDetail(orderId);
    if (!order) return { ok: false, error: "Order not found" };
    orderNumber = order.orderNumber;
    if (!canSendToThintent(order.status)) {
      return { ok: false, error: `A ${order.status} order isn't sent to Thintent` };
    }

    const payload = buildThintentOrderPayload(order, {
      siteOrigin,
      productLabels: await getProductLabels(),
      test: !!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
      pressKey: process.env.THINTENT_API_KEY!,
      feePence: await orderFeePence(order.stripe.paymentIntentId, order.orderNumber),
    });
    const body = await postToThintent<{ jobNumber?: number | string; url?: string; duplicate?: boolean }>(
      "/api/v1/orders",
      payload,
      (answer) => answer.jobNumber !== undefined,
    );

    const jobRef = String(body.jobNumber);
    const jobUrl = body.url ?? null;
    await db.update(orders).set({ thintentJobRef: jobRef, thintentJobUrl: jobUrl }).where(eq(orders.id, orderId));
    await addOrderEvent(orderId, {
      type: "thintent_pushed",
      actor,
      note: body.duplicate ? `Already in Thintent as job #${jobRef}` : `Sent to Thintent as job #${jobRef}`,
    });
    // Any refund made before the job existed had nothing to attach to until now.
    await pushOrderRefundsToThintent(orderId, actor);
    return { ok: true, jobRef, jobUrl, duplicate: !!body.duplicate };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Sending order ${orderNumber} to Thintent failed`, error);
    await recordPushFailure(orderId, actor, message).catch(() => undefined);
    return { ok: false, error: message };
  }
}

/**
 * POST a JSON body to Thintent's API and return its answer. Throws, with
 * Thintent's own error and issues in the message, on a refusal or an answer
 * that lacks what `accepted` looks for.
 */
async function postToThintent<T extends object>(
  path: string,
  payload: unknown,
  accepted: (answer: T) => boolean,
): Promise<T> {
  const response = await fetch(new URL(path, process.env.THINTENT_API_URL), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.THINTENT_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string; issues?: string[] };
  if (!response.ok || !accepted(body)) {
    const detail = [body.error, ...(body.issues ?? [])].filter(Boolean).join("; ");
    throw new Error(`Thintent answered ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return body;
}

/**
 * Stripe's fee on the order's payment, for Thintent's costs. A Stripe error
 * sends the order without it (null) rather than holding the job back: a
 * funeral date doesn't wait for a fee, and Thintent reads null as "not known".
 */
async function orderFeePence(paymentIntentId: string | null, orderNumber: string): Promise<number | null> {
  if (!paymentIntentId || !isStripeConfigured()) return null;
  try {
    return await retrievePaymentFeePence(paymentIntentId);
  } catch (error) {
    console.error(`Reading Stripe's fee for order ${orderNumber} failed`, error);
    return null;
  }
}

/** The order's job ref; null = not in Thintent yet, undefined = no such order. */
export async function getThintentJobRef(orderId: string): Promise<string | null | undefined> {
  const [order] = await db
    .select({ jobRef: orders.thintentJobRef })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return order ? order.jobRef : undefined;
}

export type ThintentRefundPushResult = { sent: number; errors: string[] };

/**
 * Send an order's succeeded refunds that Thintent hasn't recorded yet. Each
 * becomes a credit note there, born refunded — the money already went back
 * in Stripe; Thintent moves none. Needs the order's job (a refund has
 * nothing to attach to before it), but not a sendable status: refunds are
 * what happen to cancelled orders. Safe to repeat: Thintent keys the credit
 * note on the Stripe refund id. Never throws.
 */
export async function pushOrderRefundsToThintent(orderId: string, actor = "system"): Promise<ThintentRefundPushResult> {
  const result: ThintentRefundPushResult = { sent: 0, errors: [] };
  if (!isThintentConfigured()) return result;
  try {
    const [order] = await db
      .select({ orderNumber: orders.orderNumber, jobRef: orders.thintentJobRef })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order?.jobRef) return result;
    const pending = await db
      .select({
        stripeRefundId: orderRefunds.stripeRefundId,
        amountPence: orderRefunds.amountPence,
        status: orderRefunds.status,
        refundedAt: orderRefunds.refundedAt,
      })
      .from(orderRefunds)
      .where(
        and(
          eq(orderRefunds.orderId, orderId),
          eq(orderRefunds.status, "succeeded"),
          isNull(orderRefunds.thintentCreditRef),
        ),
      )
      .orderBy(asc(orderRefunds.refundedAt));

    for (const refund of pending) {
      try {
        const body = await postToThintent<{ creditNoteNumber?: number; duplicate?: boolean }>(
          `/api/v1/orders/${encodeURIComponent(order.orderNumber)}/refunds`,
          buildThintentRefundPayload(refund),
          (answer) => answer.creditNoteNumber !== undefined,
        );
        const creditRef = `CN-${body.creditNoteNumber}`;
        // Conditional, so an overlapping send doesn't write the event twice.
        const [update] = await db
          .update(orderRefunds)
          .set({ thintentCreditRef: creditRef })
          .where(and(eq(orderRefunds.stripeRefundId, refund.stripeRefundId), isNull(orderRefunds.thintentCreditRef)));
        if (update.affectedRows > 0) {
          await addOrderEvent(orderId, {
            type: "thintent_refund_pushed",
            actor,
            note: `${formatPence(refund.amountPence)} refund recorded in Thintent as ${creditRef}${body.duplicate ? " (already there)" : ""}`,
          });
        }
        result.sent += 1;
      } catch (error) {
        const message = `Refund ${refund.stripeRefundId}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`Sending a refund on order ${order.orderNumber} to Thintent failed`, error);
        result.errors.push(message);
        await recordPushFailure(orderId, actor, message).catch(() => undefined);
      }
    }
  } catch (error) {
    console.error(`Sending refunds on order ${orderId} to Thintent failed`, error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}

/**
 * Orders with a succeeded refund Thintent hasn't recorded — what the hourly
 * sweep retries. A refund younger than `minAgeMinutes` is left to the send
 * the Stripe webhook already started, so the two don't race into Thintent;
 * one older than `days` has had its week of retries.
 */
export async function listOrdersWithRefundsAwaitingThintent(
  days = 7,
  minAgeMinutes = 10,
  now = new Date(),
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: orderRefunds.orderId })
    .from(orderRefunds)
    .innerJoin(orders, eq(orders.id, orderRefunds.orderId))
    .where(
      and(
        eq(orderRefunds.status, "succeeded"),
        isNull(orderRefunds.thintentCreditRef),
        isNotNull(orders.thintentJobRef),
        gte(orderRefunds.createdAt, new Date(now.getTime() - days * 24 * 60 * 60 * 1000)),
        lte(orderRefunds.createdAt, new Date(now.getTime() - minAgeMinutes * 60 * 1000)),
      ),
    );
  return rows.map((row) => row.id);
}

/**
 * The hourly sweep retries a refused order for a week; the same refusal
 * again is not news, so it doesn't add a row to the order's history each hour.
 */
async function recordPushFailure(orderId: string, actor: string, note: string): Promise<void> {
  const [latest] = await db
    .select({ type: orderEvents.type, note: orderEvents.note })
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id))
    .limit(1);
  if (latest?.type === "thintent_failed" && latest.note === note) return;
  await addOrderEvent(orderId, { type: "thintent_failed", actor, note });
}

/**
 * Paid orders from the last `days` that never reached Thintent — what the
 * hourly sweep retries. Bounded so an order that can never be accepted
 * (Thintent refusing it with a 422) stops being retried after a week; its
 * thintent_failed events stay on the order for an admin to see. One paid
 * less than `minAgeMinutes` ago is left to fulfilment's own send, which
 * waits for the proofs: a repeat send only returns the job already made, so
 * a job sent before its proofs would link "no proof yet" for good.
 * Only awaiting_print orders (canSendToThintent).
 */
export async function listOrdersAwaitingThintent(
  days = 7,
  minAgeMinutes = 10,
  now = new Date(),
): Promise<string[]> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        isNull(orders.thintentJobRef),
        eq(orders.status, "awaiting_print"),
        gte(orders.paidAt, new Date(now.getTime() - days * 24 * 60 * 60 * 1000)),
        lte(orders.paidAt, new Date(now.getTime() - minAgeMinutes * 60 * 1000)),
      ),
    );
  return rows.map((row) => row.id);
}

export type ThintentEventOutcome =
  | { result: "unknown-order" }
  /** `cancelled`: this delivery is the one that cancelled the order — the caller sends the emails. */
  | { result: "applied"; orderId: string; cancelled: boolean };

/**
 * Whether a cancelled order may be reopened by its job: paid, and the cancel
 * was Thintent's. One an admin cancelled here stays cancelled whatever the
 * job does — that was a decision made on this side.
 */
async function cancelledByThintent(orderId: string): Promise<boolean> {
  const [latest] = await db
    .select({ actor: orderEvents.actor })
    .from(orderEvents)
    .where(
      and(
        eq(orderEvents.orderId, orderId),
        eq(orderEvents.type, "status_changed"),
        eq(orderEvents.toStatus, "cancelled"),
      ),
    )
    .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id))
    .limit(1);
  return latest?.actor === "thintent";
}

/**
 * Apply one job.updated webhook: move the order to the status the job now
 * means (thintentStatusMoves — forward, a cancel, or reopening a job
 * Thintent cancelled; never back otherwise) and keep the courier and
 * tracking number. Idempotent: the body is the job's full state, so a
 * repeat finds the order already there, and only the delivery whose
 * conditional move actually cancelled the order reports `cancelled`.
 */
export async function applyThintentJobEvent(event: ThintentJobEvent): Promise<ThintentEventOutcome> {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      paidAt: orders.paidAt,
      courier: orders.shippedCourier,
      trackingRef: orders.trackingRef,
    })
    .from(orders)
    .where(eq(orders.orderNumber, event.externalRef))
    .limit(1);
  if (!order) return { result: "unknown-order" };

  if (
    (event.courier && event.courier !== order.courier) ||
    (event.trackingRef && event.trackingRef !== order.trackingRef)
  ) {
    await db
      .update(orders)
      .set({
        shippedCourier: event.courier ?? order.courier,
        trackingRef: event.trackingRef ?? order.trackingRef,
      })
      .where(eq(orders.id, order.id));
  }

  const reopenable =
    order.status === "cancelled" && !!order.paidAt && (await cancelledByThintent(order.id));
  const steps = thintentStatusMoves(order.status, event.status, reopenable);

  // Staff notices are written once, not on every later save of the job.
  if (event.status === "cancelled" && !steps.length && (order.status === "shipped" || order.status === "delivered")) {
    // Too late to cancel here: it has already gone out.
    await addOrderEventOnce(order.id, {
      type: "thintent_cancelled",
      actor: "thintent",
      note: `The job was cancelled in Thintent, but this order is already ${order.status} so it stays as it is. Refund it in Stripe if that's what's wanted.`,
    });
  }
  const target = thintentTargetStatus(event.status);
  if (order.status === "refunded" && target && target !== "cancelled" && target !== "delivered") {
    // Refunded is final here, so a job reopened after the refund can't move
    // this order — but the shop may be about to print work it paid back. (A
    // delivered order refunded afterwards has a completed job: no notice.)
    await addOrderEventOnce(order.id, {
      type: "thintent_reopened_refunded",
      actor: "thintent",
      note: `The job is ${event.status} in Thintent, but this order was refunded. If it shouldn't be printed, cancel the job there again; if it should, the customer has been paid back.`,
    });
  }

  const note = event.jobNumber !== null ? `Thintent job #${event.jobNumber}: ${event.status}` : null;
  let at = order.status;
  let cancelled = false;
  for (const step of steps) {
    // A concurrent move (an admin, or a parallel delivery) wins; stop there.
    if (!(await moveOrderStatus(order.id, at, step, note, "thintent"))) break;
    if (step === "cancelled") cancelled = true;
    at = step;
  }
  // A refund made before the job was cancelled (or delivered) settles now.
  if (at !== order.status) await settleRefundedStatus(order.id);
  return { result: "applied", orderId: order.id, cancelled };
}
