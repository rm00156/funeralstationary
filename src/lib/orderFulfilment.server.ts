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
import { designs, orderItems, orderProofPages, orderProofs } from "@/db/schema";
import { isEmailConfigured, sendEmail } from "@/lib/email.server";
import {
  orderConfirmationEmail,
  orderNotificationEmail,
  proofReadyEmail,
} from "@/lib/orderEmails";
import { addOrderEvent, getOrderEmailSummary, loadOrderDetail } from "@/lib/orders.server";
import { renderProofPdf } from "@/lib/proofPdf.server";
import { renderProofPageImages } from "@/lib/proofRender.server";
import { isStorageConfigured, uploadObject } from "@/lib/storage";

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
    status: "generated",
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

/**
 * Tell the customer their proof is ready to review. Called after an admin
 * moves an order to `proof_sent`, and best-effort like everything else
 * here: a mail failure is recorded, never fatal to the status change.
 */
export async function sendProofReadyEmail(orderId: string, origin: string): Promise<void> {
  if (!isEmailConfigured()) return;
  const summary = await getOrderEmailSummary(orderId);
  if (!summary) return;
  try {
    await sendEmail({
      to: summary.contactEmail,
      ...proofReadyEmail(summary, `${origin}/orders/${orderId}`),
    });
    await addOrderEvent(orderId, {
      type: "email_sent",
      note: `proof ready sent to ${summary.contactEmail}`,
    });
  } catch (error) {
    console.error(`Proof-ready email failed for order ${orderId}`, error);
    await addOrderEvent(orderId, {
      type: "email_failed",
      note: `proof ready: ${error instanceof Error ? error.message : String(error)}`,
    }).catch(() => undefined);
  }
}
