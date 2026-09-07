/**
 * Order email content — pure builders that turn a plain order summary into
 * subject/text/html. DB-free and transport-free so they unit-test; sending
 * happens in orderFulfilment.server.ts via email.server.ts.
 */
import { formatPence } from "@/lib/orderOfServicePricing";

export interface OrderEmailItem {
  name: string;
  /** e.g. "50 copies · A5 · Full colour · 8 pages · Silk" */
  spec: string;
  copies: number;
  lineTotalPence: number;
}

export interface OrderEmailSummary {
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  items: OrderEmailItem[];
  deliveryLabel: string | null;
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

function itemsText(summary: OrderEmailSummary): string {
  return summary.items
    .map((item) => `- ${item.name}\n  ${item.spec}\n  ${formatPence(item.lineTotalPence)}`)
    .join("\n");
}

function totalsText(summary: OrderEmailSummary): string {
  const delivery =
    summary.deliveryPence === 0 ? "Free" : formatPence(summary.deliveryPence);
  return [
    `Subtotal: ${formatPence(summary.subtotalPence)}`,
    `Delivery (${summary.deliveryLabel ?? "standard"}): ${delivery}`,
    `Total: ${formatPence(summary.totalPence)} (includes VAT of ${formatPence(summary.vatPence)})`,
  ].join("\n");
}

function itemsHtml(summary: OrderEmailSummary): string {
  const rows = summary.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e1dc"><strong>${escapeHtml(item.name)}</strong><br><span style="color:#6b6560">${escapeHtml(item.spec)}</span></td><td style="padding:8px 0;border-bottom:1px solid #e6e1dc;text-align:right;white-space:nowrap">${formatPence(item.lineTotalPence)}</td></tr>`,
    )
    .join("");
  const delivery =
    summary.deliveryPence === 0 ? "Free" : formatPence(summary.deliveryPence);
  return `<table style="width:100%;border-collapse:collapse;font-family:Georgia,serif">${rows}
<tr><td style="padding:8px 0">Subtotal</td><td style="text-align:right">${formatPence(summary.subtotalPence)}</td></tr>
<tr><td style="padding:8px 0">Delivery (${escapeHtml(summary.deliveryLabel ?? "standard")})</td><td style="text-align:right">${delivery}</td></tr>
<tr><td style="padding:8px 0"><strong>Total</strong><br><span style="color:#6b6560">includes VAT of ${formatPence(summary.vatPence)}</span></td><td style="text-align:right"><strong>${formatPence(summary.totalPence)}</strong></td></tr>
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
    "We will prepare a digital proof and send it to this address for your approval before anything is printed.",
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
<p>Thank you — we have received your order <strong>${escapeHtml(summary.orderNumber)}</strong> and payment. We will prepare a digital proof and send it to this address for your approval before anything is printed.</p>
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
