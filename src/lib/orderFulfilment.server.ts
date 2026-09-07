/**
 * What happens after an order is paid: proof PDFs and emails.
 *
 * Kept apart from orders.server.ts on purpose — this is the only orders
 * module allowed to import Chromium (via proofPdf.server.ts) or the mail
 * client, so the basket/checkout routes don't trace either into their
 * bundles. Everything here is best-effort: a failure is recorded as an
 * order_events row and logged, and never fails the order itself.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orderProofs } from "@/db/schema";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import { orderConfirmationEmail, orderNotificationEmail } from "@/lib/orderEmails";
import { addOrderEvent, getOrderEmailSummary, loadOrderDetail } from "@/lib/orders.server";
import { renderProofPdf } from "@/lib/proofPdf.server";
import { isStorageConfigured, uploadObject } from "@/lib/storage";

/**
 * Render the frozen doc of one order line to a PDF, store it, and record it
 * as the next proof version. Throws when storage is unconfigured or the
 * render fails — callers decide whether that is fatal.
 */
export async function generateOrderItemProof(
  orderId: string,
  itemId: string,
  origin: string,
  actor = "system",
): Promise<{ version: number; pdfUrl: string }> {
  if (!isStorageConfigured()) {
    throw new Error("Object storage is not configured — proofs cannot be stored");
  }
  const order = await loadOrderDetail(orderId);
  if (!order) throw new Error("Order not found");
  const [item] = await db
    .select({ id: orderItems.id, docSnapshot: orderItems.docSnapshot })
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .limit(1);
  if (!item) throw new Error("Order item not found");

  const [latest] = await db
    .select({ version: orderProofs.version })
    .from(orderProofs)
    .where(eq(orderProofs.orderItemId, itemId))
    .orderBy(desc(orderProofs.version))
    .limit(1);
  const version = (latest?.version ?? 0) + 1;

  const pdf = await renderProofPdf(origin, item.docSnapshot);
  const storageKey = `orders/${order.orderNumber}/${itemId}-v${version}.pdf`;
  const pdfUrl = await uploadObject(storageKey, pdf, "application/pdf");

  await db.insert(orderProofs).values({
    id: crypto.randomUUID(),
    orderItemId: itemId,
    version,
    pdfUrl,
    storageKey,
    status: "generated",
  });
  await addOrderEvent(orderId, {
    type: "proof_generated",
    actor,
    note: `Proof v${version} generated for item ${itemId}`,
  });
  return { version, pdfUrl };
}

/**
 * Post-payment side effects, run from after() in the webhook / return
 * routes. Proofs first (skipped entirely without S3), then the customer
 * confirmation and the business notification. Never throws.
 */
export async function runPostPaymentSideEffects(orderId: string, origin: string): Promise<void> {
  const order = await loadOrderDetail(orderId);
  if (!order) return;

  if (isStorageConfigured()) {
    for (const item of order.items) {
      try {
        await generateOrderItemProof(orderId, item.id, origin);
      } catch (error) {
        console.error(`Proof generation failed for order ${order.orderNumber}, item ${item.id}`, error);
        await addOrderEvent(orderId, {
          type: "proof_failed",
          note: error instanceof Error ? error.message : String(error),
        }).catch(() => undefined);
      }
    }
  }

  if (!isEmailConfigured()) return;
  const summary = await getOrderEmailSummary(orderId);
  if (!summary) return;

  const sends: { label: string; to: string; content: ReturnType<typeof orderConfirmationEmail> }[] = [
    {
      label: "customer confirmation",
      to: summary.contactEmail,
      content: orderConfirmationEmail(summary, `${origin}/orders/${orderId}`),
    },
  ];
  const notify = process.env.ORDER_NOTIFY_EMAIL;
  if (notify) {
    sends.push({
      label: "business notification",
      to: notify,
      content: orderNotificationEmail(summary, `${origin}/admin/orders/${orderId}`),
    });
  }

  for (const send of sends) {
    try {
      await sendEmail({ to: send.to, ...send.content });
      await addOrderEvent(orderId, { type: "email_sent", note: `${send.label} sent to ${send.to}` });
    } catch (error) {
      console.error(`Email (${send.label}) failed for order ${order.orderNumber}`, error);
      await addOrderEvent(orderId, {
        type: "email_failed",
        note: `${send.label}: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => undefined);
    }
  }
}
