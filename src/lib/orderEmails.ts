/**
 * Order email content — pure builders that turn a plain order summary into
 * subject/text/html. DB-free and transport-free so they unit-test; sending
 * happens in orderFulfilment.server.ts via email.server.ts.
 */
import { formatPence } from "@/lib/orderOfServicePricing";
import { EMAIL, PHONE_DISPLAY, SITE_NAME } from "@/lib/site";
import { vatIncludedText } from "@/lib/vat";

export interface OrderEmailItem {
  name: string;
  /** e.g. "50 copies · A5 · 8 pages · Silk" */
  spec: string;
  copies: number;
  lineTotalPence: number;
  /** Delivery is chosen per line, so each item names its own. */
  deliveryLabel: string;
  deliveryPence: number;
}

export interface OrderEmailSummary {
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  items: OrderEmailItem[];
  /** Σ of the items' delivery charges. */
  deliveryPence: number;
  subtotalPence: number;
  vatPence: number;
  totalPence: number;
  addressLines: string[];
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const freeOr = (pence: number) => (pence === 0 ? "Free" : formatPence(pence));

function itemsText(summary: OrderEmailSummary): string {
  return summary.items
    .map(
      (item) =>
        `- ${item.name}\n  ${item.spec}\n  ${formatPence(item.lineTotalPence)}\n  Delivery: ${item.deliveryLabel} (${freeOr(item.deliveryPence)})`,
    )
    .join("\n");
}

/** "Includes VAT of £16.67" → "includes VAT of £16.67", for mid-sentence use. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function totalsText(summary: OrderEmailSummary): string {
  return [
    `Subtotal: ${formatPence(summary.subtotalPence)}`,
    `Delivery: ${freeOr(summary.deliveryPence)}`,
    `Total: ${formatPence(summary.totalPence)} (${lowerFirst(vatIncludedText(summary.vatPence))})`,
  ].join("\n");
}

function itemsHtml(summary: OrderEmailSummary): string {
  const rows = summary.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e1dc"><strong>${escapeHtml(item.name)}</strong><br><span style="color:#6b6560">${escapeHtml(item.spec)}<br>Delivery: ${escapeHtml(item.deliveryLabel)} (${freeOr(item.deliveryPence)})</span></td><td style="padding:8px 0;border-bottom:1px solid #e6e1dc;text-align:right;white-space:nowrap">${formatPence(item.lineTotalPence)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-family:Georgia,serif">${rows}
<tr><td style="padding:8px 0">Subtotal</td><td style="text-align:right">${formatPence(summary.subtotalPence)}</td></tr>
<tr><td style="padding:8px 0">Delivery</td><td style="text-align:right">${freeOr(summary.deliveryPence)}</td></tr>
<tr><td style="padding:8px 0"><strong>Total</strong><br><span style="color:#6b6560">${lowerFirst(vatIncludedText(summary.vatPence))}</span></td><td style="text-align:right"><strong>${formatPence(summary.totalPence)}</strong></td></tr>
</table>`;
}

/** Sent to the customer once payment has completed. */
export function orderConfirmationEmail(
  summary: OrderEmailSummary,
  orderUrl: string,
): EmailContent {
  const subject = `Your order ${summary.orderNumber} — The Funeral Stationery`;
  const text = [
    `Dear ${summary.contactName},`,
    "",
    `Thank you — we have received your order ${summary.orderNumber} and payment.`,
    "Your stationery is now queued for printing, exactly as you designed and confirmed it.",
    "",
    itemsText(summary),
    "",
    totalsText(summary),
    "",
    "Delivering to:",
    ...summary.addressLines,
    "",
    `You can view your order at ${orderUrl}`,
    "",
    "With our sincere condolences,",
    "The Funeral Stationery",
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#2f2a26;max-width:560px">
<p>Dear ${escapeHtml(summary.contactName)},</p>
<p>Thank you — we have received your order <strong>${escapeHtml(summary.orderNumber)}</strong> and payment. Your stationery is now queued for printing, exactly as you designed and confirmed it.</p>
${itemsHtml(summary)}
<p style="margin-top:24px"><strong>Delivering to</strong><br>${summary.addressLines.map(escapeHtml).join("<br>")}</p>
<p><a href="${escapeHtml(orderUrl)}">View your order</a></p>
<p>With our sincere condolences,<br>The Funeral Stationery</p>
</div>`;
  return { subject, text, html };
}

/** Sent to the business inbox so a new order isn't missed. */
export function orderNotificationEmail(
  summary: OrderEmailSummary,
  adminUrl: string,
): EmailContent {
  const subject = `New order ${summary.orderNumber} — ${formatPence(summary.totalPence)}`;
  const text = [
    `New paid order ${summary.orderNumber} from ${summary.contactName} <${summary.contactEmail}>.`,
    "",
    itemsText(summary),
    "",
    totalsText(summary),
    "",
    "Deliver to:",
    ...summary.addressLines,
    "",
    `Manage it at ${adminUrl}`,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#2f2a26;max-width:560px">
<p>New paid order <strong>${escapeHtml(summary.orderNumber)}</strong> from ${escapeHtml(summary.contactName)} &lt;${escapeHtml(summary.contactEmail)}&gt;.</p>
${itemsHtml(summary)}
<p style="margin-top:24px"><strong>Deliver to</strong><br>${summary.addressLines.map(escapeHtml).join("<br>")}</p>
<p><a href="${escapeHtml(adminUrl)}">Open in admin</a></p>
</div>`;
  return { subject, text, html };
}

/**
 * Sent to the customer when the shop cancels a paid order (from Thintent).
 * Says a refund *will* follow only as far as the shop has promised one: the
 * refund is a separate step a person makes in Stripe, so this tells them
 * where it goes and how to ask, not that it has happened.
 */
export function orderCancelledEmail(summary: OrderEmailSummary, orderUrl: string): EmailContent {
  const subject = `Your order ${summary.orderNumber} has been cancelled — ${SITE_NAME}`;
  const text = [
    `Dear ${summary.contactName},`,
    "",
    `Your order ${summary.orderNumber} has been cancelled and will not be printed.`,
    `If a refund is due, it will go back to the card you paid with. If you didn't expect this, or have any questions, please call us on ${PHONE_DISPLAY} or email ${EMAIL}.`,
    "",
    itemsText(summary),
    "",
    `You can view your order at ${orderUrl}`,
    "",
    "With our sincere condolences,",
    SITE_NAME,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#2f2a26;max-width:560px">
<p>Dear ${escapeHtml(summary.contactName)},</p>
<p>Your order <strong>${escapeHtml(summary.orderNumber)}</strong> has been cancelled and will not be printed.</p>
<p>If a refund is due, it will go back to the card you paid with. If you didn't expect this, or have any questions, please call us on ${escapeHtml(PHONE_DISPLAY)} or email <a href="mailto:${escapeHtml(EMAIL)}">${escapeHtml(EMAIL)}</a>.</p>
${itemsHtml(summary)}
<p style="margin-top:24px"><a href="${escapeHtml(orderUrl)}">View your order</a></p>
<p>With our sincere condolences,<br>${SITE_NAME}</p>
</div>`;
  return { subject, text, html };
}

/**
 * Sent to the business inbox when Thintent cancels a paid order. A cancel
 * never moves money, so it says what has gone back so far (a refund can be
 * made before the cancel) and what is left to decide.
 */
export function orderCancelledNotificationEmail(
  summary: OrderEmailSummary,
  adminUrl: string,
  refundedPence = 0,
): EmailContent {
  const outstanding = summary.totalPence - refundedPence;
  const subject =
    outstanding <= 0
      ? `Cancelled: order ${summary.orderNumber} — already refunded`
      : `Cancelled: order ${summary.orderNumber} — refund ${formatPence(outstanding)}?`;
  const refundText =
    refundedPence <= 0
      ? "Nothing has been refunded — if a refund is due, make it in Stripe."
      : outstanding <= 0
        ? `It has already been refunded in full (${formatPence(refundedPence)}) in Stripe — there is nothing more to refund.`
        : `${formatPence(refundedPence)} of it has been refunded in Stripe so far — if more is due, make it there.`;
  const text = [
    `Order ${summary.orderNumber} from ${summary.contactName} <${summary.contactEmail}> was cancelled in Thintent.`,
    `The customer paid ${formatPence(summary.totalPence)}. ${refundText}`,
    "",
    `Order: ${adminUrl}`,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#2f2a26;max-width:560px">
<p>Order <strong>${escapeHtml(summary.orderNumber)}</strong> from ${escapeHtml(summary.contactName)} &lt;${escapeHtml(summary.contactEmail)}&gt; was cancelled in Thintent.</p>
<p>The customer paid <strong>${formatPence(summary.totalPence)}</strong>. ${refundText}</p>
<p><a href="${escapeHtml(adminUrl)}">Open in admin</a></p>
</div>`;
  return { subject, text, html };
}

/**
 * The one-time sign-in link. Deliberately says nothing about whether the
 * address already has designs or orders — the sign-in form answers the same
 * way for every address, and so does this.
 */
export function signInEmail(linkUrl: string): EmailContent {
  const subject = "Your sign-in link — The Funeral Stationery";
  const text = [
    "Hello,",
    "",
    "Use the link below to sign in and see the designs and orders saved to this email address:",
    linkUrl,
    "",
    "The link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email — nothing has changed.",
    "",
    "The Funeral Stationery",
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#2f2a26;max-width:560px">
<p>Hello,</p>
<p>Use the link below to sign in and see the designs and orders saved to this email address.</p>
<p><a href="${escapeHtml(linkUrl)}" style="display:inline-block;padding:12px 20px;background:#5c4b51;color:#ffffff;text-decoration:none;border-radius:8px">Sign in</a></p>
<p style="color:#6b6560;font-size:13px">The link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email — nothing has changed.</p>
<p>The Funeral Stationery</p>
</div>`;
  return { subject, text, html };
}

/** An admin's one-time sign-in link to /admin. */
export function adminSignInEmail(linkUrl: string): EmailContent {
  const subject = "Admin sign-in link — The Funeral Stationery";
  const text = [
    "Hello,",
    "",
    "Use the link below to sign in to the admin area of The Funeral Stationery:",
    linkUrl,
    "",
    "The link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email — nobody can sign in without it.",
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#2f2a26;max-width:560px">
<p>Hello,</p>
<p>Use the link below to sign in to the admin area of The Funeral Stationery.</p>
<p><a href="${escapeHtml(linkUrl)}" style="display:inline-block;padding:12px 20px;background:#5c4b51;color:#ffffff;text-decoration:none;border-radius:8px">Sign in to admin</a></p>
<p style="color:#6b6560;font-size:13px">The link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email — nobody can sign in without it.</p>
</div>`;
  return { subject, text, html };
}

/**
 * Sent when an admin grants someone access. It links to the sign-in page
 * (address filled in), not a sign-in link: an invitation can sit unread for
 * days, and a long-lived link that signs whoever holds it in would be a key
 * left lying in an inbox.
 */
export function adminInviteEmail({
  signInPageUrl,
  invitedBy,
}: {
  signInPageUrl: string;
  invitedBy: string;
}): EmailContent {
  const subject = "You've been given admin access — The Funeral Stationery";
  const text = [
    "Hello,",
    "",
    `${invitedBy} has given this email address access to the admin area of The Funeral Stationery.`,
    "",
    "To sign in, open the page below and ask for a sign-in link. We'll email you a link that signs you in — there is no password.",
    signInPageUrl,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#2f2a26;max-width:560px">
<p>Hello,</p>
<p>${escapeHtml(invitedBy)} has given this email address access to the admin area of The Funeral Stationery.</p>
<p>To sign in, open the page below and ask for a sign-in link. We&rsquo;ll email you a link that signs you in — there is no password.</p>
<p><a href="${escapeHtml(signInPageUrl)}" style="display:inline-block;padding:12px 20px;background:#5c4b51;color:#ffffff;text-decoration:none;border-radius:8px">Go to admin sign-in</a></p>
</div>`;
  return { subject, text, html };
}
