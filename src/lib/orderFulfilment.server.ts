/**
 * What happens after an order is paid: proofs and emails.
 *
 * Kept apart from orders.server.ts on purpose — this is the only orders
 * module allowed to import Chromium (via proofRender.server.ts) or the mail
 * client, so the basket/checkout routes don't trace either into their
 * bundles. Everything here is best-effort: a failure is recorded as an
 * order_events row and logged, and never fails the order itself.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import type { DesignDoc } from "@/lib/designEditor";
import { designs, orderItems, orderProofPages, orderProofs, orderRefunds } from "@/db/schema";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import {
  orderCancelledEmail,
  orderCancelledNotificationEmail,
  orderConfirmationEmail,
  orderNotificationEmail,
  type EmailContent,
} from "@/lib/orderEmails";
import { refundedPence } from "@/lib/orders";
import { addOrderEvent, getOrderEmailSummary, loadOrderDetail } from "@/lib/orders.server";
import { renderProofPdf } from "@/lib/proofPdf.server";
import { renderProofPageImages } from "@/lib/proofRender.server";
import { isStorageConfigured, uploadObject } from "@/lib/storage";
import { isThintentConfigured, pushOrderToThintent } from "@/lib/thintent.server";

/**
 * The artwork to proof for one line: the live design when it still exists,
 * otherwise the payment snapshot.
 *
 * Reading live is what makes the change-request loop work — an admin fixes
 * the design and the next proof version picks the correction up. The item's
 * own docSnapshot never moves; it is the frozen record of what was paid
 * for, and it is the fallback when the customer has deleted the design.
 *
 * Deliberately unscoped by Owner: this runs from the Stripe webhook, which
 * has no cookie, and from the admin area.
 */
async function proofArtwork(
  designId: string | null,
  fallback: DesignDoc,
): Promise<DesignDoc> {
  if (!designId) return fallback;
  const [row] = await db
    .select({ doc: designs.doc })
    .from(designs)
    .where(and(eq(designs.id, designId), isNull(designs.deletedAt)))
    .limit(1);
  return row?.doc ?? fallback;
}

async function loadProofContext(orderId: string, itemId: string) {
  const order = await loadOrderDetail(orderId);
  if (!order) throw new Error("Order not found");
  const [item] = await db
    .select({
      id: orderItems.id,
      designId: orderItems.designId,
      docSnapshot: orderItems.docSnapshot,
    })
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .limit(1);
  if (!item) throw new Error("Order item not found");
  return { order, item };
}

/**
 * Render one order line to page images, store them, and record the next
 * proof version. This is what the customer reviews and approves — screen
 * resolution, no PDF. The press file is generated separately, on demand,
 * by generateOrderItemPrintPdf.
 *
 * Throws when storage is unconfigured or the render fails — callers decide
 * whether that is fatal.
 */
export async function generateOrderItemProof(
  orderId: string,
  itemId: string,
  origin: string,
  actor = "system",
): Promise<{ version: number; pageCount: number }> {
  if (!isStorageConfigured()) {
    throw new Error("Object storage is not configured — proofs cannot be stored");
  }
  const { order, item } = await loadProofContext(orderId, itemId);

  const [latest] = await db
    .select({ version: orderProofs.version })
    .from(orderProofs)
    .where(eq(orderProofs.orderItemId, itemId))
    .orderBy(desc(orderProofs.version))
    .limit(1);
  const version = (latest?.version ?? 0) + 1;

  if (!item.docSnapshot) {
    // The customer's own artwork: their PDF is the press file, and there is
    // no design to render.
    throw new Error("This line is the customer's own artwork — there is nothing to render");
  }
  const doc = await proofArtwork(item.designId, item.docSnapshot);
  const images = await renderProofPageImages(origin, doc);

  const proofId = crypto.randomUUID();
  const pages = await Promise.all(
    images.map(async (bytes, index) => {
      const storageKey = `orders/${order.orderNumber}/${itemId}-v${version}/p${index + 1}.jpg`;
      const imageUrl = await uploadObject(storageKey, Buffer.from(bytes), "image/jpeg");
      return { id: crypto.randomUUID(), proofId, pageIndex: index, imageUrl, storageKey };
    }),
  );

  await db.insert(orderProofs).values({
    id: proofId,
    orderItemId: itemId,
    version,
    docSnapshot: doc,
  });
  await db.insert(orderProofPages).values(pages);
  await addOrderEvent(orderId, {
    type: "proof_generated",
    actor,
    note: `Proof v${version} generated for item ${itemId} (${pages.length} pages)`,
  });
  return { version, pageCount: pages.length };
}

/**
 * Admin-only: render the press file for an existing proof version and hang
 * it off that row. Generated on demand rather than at payment because it is
 * expensive, nobody but the press reads it, and it should be made from the
 * artwork the customer actually approved — which is why it renders the
 * version's own docSnapshot rather than anything live.
 */
export async function generateOrderItemPrintPdf(
  orderId: string,
  proofId: string,
  origin: string,
  actor = "admin",
): Promise<{ version: number; pdfUrl: string }> {
  if (!isStorageConfigured()) {
    throw new Error("Object storage is not configured — proofs cannot be stored");
  }
  const [proof] = await db
    .select({
      id: orderProofs.id,
      version: orderProofs.version,
      orderItemId: orderProofs.orderItemId,
      docSnapshot: orderProofs.docSnapshot,
    })
    .from(orderProofs)
    .innerJoin(orderItems, eq(orderProofs.orderItemId, orderItems.id))
    .where(and(eq(orderProofs.id, proofId), eq(orderItems.orderId, orderId)))
    .limit(1);
  if (!proof) throw new Error("Proof not found");

  const order = await loadOrderDetail(orderId);
  if (!order) throw new Error("Order not found");

  const pdf = await renderProofPdf(origin, proof.docSnapshot);
  const storageKey = `orders/${order.orderNumber}/${proof.orderItemId}-v${proof.version}.pdf`;
  const pdfUrl = await uploadObject(storageKey, pdf, "application/pdf");

  await db
    .update(orderProofs)
    .set({ pdfUrl, storageKey })
    .where(eq(orderProofs.id, proofId));
  await addOrderEvent(orderId, {
    type: "print_pdf_generated",
    actor,
    note: `Print PDF rendered for proof v${proof.version}`,
  });
  return { version: proof.version, pdfUrl };
}

/**
 * The print PDF of a line's newest proof, rendering it first when nobody has
 * yet — what a press link from Thintent opens (/api/thintent/press). Newest
 * rather than the version the job was sent with, so a corrected proof made
 * after the job reached Thintent is what the press gets. Null when the line
 * has no proof at all.
 */
export async function newestPrintPdfUrl(
  orderId: string,
  itemId: string,
  origin: string,
): Promise<string | null> {
  const [proof] = await db
    .select({ id: orderProofs.id, pdfUrl: orderProofs.pdfUrl })
    .from(orderProofs)
    .innerJoin(orderItems, eq(orderProofs.orderItemId, orderItems.id))
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .orderBy(desc(orderProofs.version))
    .limit(1);
  if (!proof) return null;
  if (proof.pdfUrl) return proof.pdfUrl;
  const { pdfUrl } = await generateOrderItemPrintPdf(orderId, proof.id, origin, "thintent");
  return pdfUrl;
}

/**
 * Post-payment side effects, run from after() in the webhook / return
 * routes. Proofs first (skipped entirely without S3), then the customer
 * confirmation and the business notification, then the job in Thintent
 * (skipped without THINTENT_*). Never throws.
 *
 * Two origins because they answer different questions: `site` is the public
 * origin the emailed links must carry; `render` is where this server's own
 * headless Chromium reaches /proof-render (see renderOrigin).
 */
export async function runPostPaymentSideEffects(
  orderId: string,
  origins: { site: string; render: string },
): Promise<void> {
  const order = await loadOrderDetail(orderId);
  if (!order) return;

  if (isStorageConfigured()) {
    // Artwork lines are skipped: the customer's file is already the press file.
    for (const item of order.items.filter((line) => !line.artwork)) {
      try {
        await generateOrderItemProof(orderId, item.id, origins.render);
      } catch (error) {
        console.error(`Proof generation failed for order ${order.orderNumber}, item ${item.id}`, error);
        await addOrderEvent(orderId, {
          type: "proof_failed",
          note: error instanceof Error ? error.message : String(error),
        }).catch(() => undefined);
      }
    }
  }

  await sendOrderConfirmationEmails(orderId, origins.site);

  // After the proofs, so the job in Thintent gets a print-PDF link rather
  // than "no proof yet" (see lineFiles in thintent.ts); after the emails,
  // because a send that runs out of time is retried by the hourly sweep and
  // an email is never retried.
  if (isThintentConfigured()) await pushOrderToThintent(orderId, origins.site);
}

async function sendOrderConfirmationEmails(orderId: string, siteOrigin: string): Promise<void> {
  if (!isEmailConfigured()) return;
  const summary = await getOrderEmailSummary(orderId);
  if (!summary) return;

  const sends: OrderEmailSend[] = [
    {
      label: "customer confirmation",
      to: summary.contactEmail,
      content: orderConfirmationEmail(summary, `${siteOrigin}/orders/${orderId}`),
    },
  ];
  const notify = process.env.ORDER_NOTIFY_EMAIL;
  if (notify) {
    sends.push({
      label: "business notification",
      to: notify,
      content: orderNotificationEmail(summary, `${siteOrigin}/admin/orders/${orderId}`),
    });
  }
  await sendOrderEmails(orderId, summary.orderNumber, sends);
}

/**
 * After Thintent cancels a paid order: tell the customer it won't be
 * printed, and the shop that the refund is still theirs to make. Called
 * only by the delivery that actually cancelled it (applyThintentJobEvent),
 * so a redelivered webhook doesn't email twice. Best-effort, like the rest.
 */
export async function sendOrderCancelledEmails(orderId: string, siteOrigin: string): Promise<void> {
  if (!isEmailConfigured()) return;
  const summary = await getOrderEmailSummary(orderId);
  if (!summary) return;

  const sends: OrderEmailSend[] = [
    {
      label: "customer cancellation",
      to: summary.contactEmail,
      content: orderCancelledEmail(summary, `${siteOrigin}/orders/${orderId}`),
    },
  ];
  const notify = process.env.ORDER_NOTIFY_EMAIL;
  if (notify) {
    sends.push({
      label: "business cancellation notice",
      to: notify,
      content: orderCancelledNotificationEmail(
        summary,
        `${siteOrigin}/admin/orders/${orderId}`,
        await orderRefundedPence(orderId),
      ),
    });
  }
  await sendOrderEmails(orderId, summary.orderNumber, sends);
}

/** What has gone back to the customer so far — a refund can come before the cancel. */
async function orderRefundedPence(orderId: string): Promise<number> {
  const refunds = await db
    .select({ amountPence: orderRefunds.amountPence, status: orderRefunds.status })
    .from(orderRefunds)
    .where(eq(orderRefunds.orderId, orderId));
  return refundedPence(refunds);
}

interface OrderEmailSend {
  label: string;
  to: string;
  content: EmailContent;
}

/** Each send recorded on the order as email_sent / email_failed; none throws. */
async function sendOrderEmails(orderId: string, orderNumber: string, sends: OrderEmailSend[]): Promise<void> {
  for (const send of sends) {
    try {
      await sendEmail({ to: send.to, ...send.content });
      await addOrderEvent(orderId, { type: "email_sent", note: `${send.label} sent to ${send.to}` });
    } catch (error) {
      console.error(`Email (${send.label}) failed for order ${orderNumber}`, error);
      await addOrderEvent(orderId, {
        type: "email_failed",
        note: `${send.label}: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => undefined);
    }
  }
}
