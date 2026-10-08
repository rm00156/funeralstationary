/**
 * Order email content — pure builders that turn a plain order summary into
 * subject/text/html. DB-free and transport-free so they unit-test; sending
 * happens in orderFulfilment.server.ts via email.server.ts.
 */
import {
  EMAIL_LOGO_ATTACHMENT,
  EMAIL_LOGO_CID,
  EMAIL_LOGO_HEIGHT,
  EMAIL_LOGO_WIDTH,
} from "@/lib/emailLogo";
import { formatServiceDate } from "@/lib/contact";
import { formatPence } from "@/lib/orderOfServicePricing";
import { EMAIL, OPENING_HOURS, PHONE_DISPLAY, SITE_NAME, STANDARD_TURNAROUND } from "@/lib/site";
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
  /** yyyy-mm-dd, the funeral date asked at checkout; optional, so often null. */
  serviceDate: string | null;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  /** Referenced from the html as `cid:<contentId>`, which makes it inline. */
  contentId: string;
  /** Base64. */
  content: string;
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
  /** Where a reply goes: the shop's inbox for a customer, the customer for staff. */
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** Extra mail headers — List-Unsubscribe on the review request. */
  headers?: Record<string, string>;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const freeOr = (pence: number) => (pence === 0 ? "Free" : formatPence(pence));

/*
 * The branded shell every customer-facing and staff email is built on. Tables
 * and inline styles, because that is all Gmail and Outlook reliably render;
 * colours are the site's plum on warm paper (globals.css), type is Georgia for
 * headings and Arial for reading, 17px body for older eyes. The logo is an
 * inline attachment, so an email built on this returns `brandedAttachments()`
 * beside its html.
 */
const PLUM = "#5a2760";
const INK = "#2b2230";
const INK_2 = "#4e4552";
const LABEL = "#6a5f6c";
const LINE = "#ece3ea";
const PAPER = "#fbf8f5";
const MIST = "#f5eff4";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";

const brandedAttachments = (): EmailAttachment[] => [{ ...EMAIL_LOGO_ATTACHMENT }];

/** A paragraph of already-escaped HTML. */
const paragraph = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:17px;line-height:1.6;color:${INK_2}">${html}</p>`;

/** A small uppercase label over a section. */
const eyebrow = (label: string) =>
  `<p style="margin:32px 0 12px;font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${LABEL}">${escapeHtml(label)}</p>`;

/** A plum button (a table cell, so Outlook draws its background). */
const button = (label: string, url: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr>
<td style="border-radius:8px;background:${PLUM}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:17px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a></td>
</tr></table>`;

/** The link spelled out under a button, for a client that won't show it. */
const fallbackLink = (url: string) =>
  `<p style="margin:20px 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${LABEL}">Button not working? Copy this link into your browser:<br><a href="${escapeHtml(url)}" style="color:${PLUM};word-break:break-all">${escapeHtml(url)}</a></p>`;

/** Small print under a rule: expiry notes and the like. */
const finePrint = (html: string) =>
  `<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-family:${SANS};font-size:14px;line-height:1.6;color:${LABEL}">${html}</p>`;

/**
 * Label/value pairs in a tinted box: the order number, the funeral date.
 * Inline blocks rather than table cells, so on a phone they wrap onto their
 * own lines instead of squeezing side by side.
 */
function factsBox(facts: Array<[label: string, value: string]>): string {
  const cells = facts
    .map(
      ([label, value]) =>
        `<div style="display:inline-block;vertical-align:top;padding:16px 20px"><span style="font-family:${SANS};font-size:13px;color:${LABEL}">${escapeHtml(label)}</span><br><span style="font-family:${SERIF};font-size:19px;color:${INK}">${escapeHtml(value)}</span></div>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:${MIST};border-radius:8px"><tr><td style="padding:0">${cells}</td></tr></table>`;
}

function itemsHtml(summary: OrderEmailSummary): string {
  return summary.items
    .map(
      (item) => `<tr>
<td valign="top" style="padding:16px 12px 16px 0;border-bottom:1px solid ${LINE}"><span style="font-family:${SERIF};font-size:19px;line-height:1.4;color:${INK}">${escapeHtml(item.name)}</span><br><span style="font-family:${SANS};font-size:15px;line-height:1.6;color:${LABEL}">${escapeHtml(item.spec)}<br>${escapeHtml(item.deliveryLabel)} · ${freeOr(item.deliveryPence)}</span></td>
<td valign="top" align="right" style="padding:16px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:17px;color:${INK};white-space:nowrap">${formatPence(item.lineTotalPence)}</td>
</tr>`,
    )
    .join("");
}

function totalsHtml(summary: OrderEmailSummary): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:12px 0 0;font-family:${SANS};font-size:16px;color:${INK_2}">${label}</td><td align="right" style="padding:12px 0 0;font-family:${SANS};font-size:16px;color:${INK_2}">${value}</td></tr>`;
  return `${row("Subtotal", formatPence(summary.subtotalPence))}
${row("Delivery", freeOr(summary.deliveryPence))}
<tr><td style="padding:16px 0 0;font-family:${SERIF};font-size:20px;color:${INK}">Total<br><span style="font-family:${SANS};font-size:14px;color:${LABEL}">${escapeHtml(lowerFirst(vatIncludedText(summary.vatPence)))}</span></td><td align="right" valign="top" style="padding:16px 0 0;font-family:${SERIF};font-size:22px;font-weight:bold;color:${PLUM};white-space:nowrap">${formatPence(summary.totalPence)}</td></tr>`;
}

/** The lines, then the totals, as one table so the prices line up. */
function orderTableHtml(summary: OrderEmailSummary, withTotals = true): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml(summary)}${withTotals ? totalsHtml(summary) : ""}</table>`;
}

/**
 * The address, in a block whose links are styled away: Gmail and Apple Mail
 * turn a street address into a blue map link, which reads as a mistake here.
 */
const addressHtml = (lines: string[]) =>
  `<p class="addr" style="margin:0;font-family:${SANS};font-size:17px;line-height:1.6;color:${INK_2}">${lines.map(escapeHtml).join("<br>")}</p>`;

/** Numbered "what happens next" steps; each is [title, already-escaped body]. */
function stepsHtml(steps: Array<[title: string, body: string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps
    .map(
      ([title, body], i) => `<tr>
<td valign="top" width="44" style="padding:0 0 16px"><div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${MIST};color:${PLUM};font-family:${SERIF};font-size:16px;text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:4px 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${INK_2}"><strong style="color:${INK}">${escapeHtml(title)}</strong><br>${body}</td>
</tr>`,
    )
    .join("")}</table>`;
}

const signOff = (closing: string) =>
  `<p style="margin:32px 0 0;font-family:${SANS};font-size:17px;line-height:1.6;color:${INK_2}">${escapeHtml(closing)}<br><span style="font-family:${SERIF};font-size:19px;color:${INK}">${escapeHtml(SITE_NAME)}</span></p>`;

/**
 * The page around an email's content: logo, a white card with the heading,
 * the shop's contact line beneath. `preheader` is the grey preview line an
 * inbox shows beside the subject — without one it shows the first words of
 * the body, which in every email here would be the logo's alt text.
 */
function brandedEmailHtml({
  preheader,
  heading,
  body,
}: {
  preheader: string;
  heading: string;
  /** Already-escaped HTML, built from the pieces above. */
  body: string;
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>.addr a,a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}</style>
</head><body style="margin:0;padding:0;background:${PAPER}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td align="center" style="padding:0 0 24px;font-family:${SERIF};font-size:22px;color:${PLUM}"><img src="cid:${EMAIL_LOGO_CID}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="${escapeHtml(SITE_NAME)}" style="display:block;border:0;outline:none;text-decoration:none;width:${EMAIL_LOGO_WIDTH}px;max-width:100%;height:auto"></td></tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;padding:40px 36px">
<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:28px;font-weight:normal;line-height:1.3;color:${INK}">${escapeHtml(heading)}</h1>
${body}
</td></tr>
<tr><td align="center" style="padding:24px 0 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${LABEL}">${escapeHtml(SITE_NAME)}<br>${escapeHtml(PHONE_DISPLAY)} · ${escapeHtml(OPENING_HOURS)} · <a href="mailto:${escapeHtml(EMAIL)}" style="color:${LABEL}">${escapeHtml(EMAIL)}</a></td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** An email whose job is one button: a sign-in link or an invitation. */
function buttonEmailHtml({
  preheader,
  heading,
  paragraphs,
  buttonLabel,
  buttonUrl,
  finePrint: fine,
}: {
  preheader: string;
  heading: string;
  /** Already-escaped HTML. */
  paragraphs: string[];
  buttonLabel: string;
  buttonUrl: string;
  finePrint?: string;
}): string {
  return brandedEmailHtml({
    preheader,
    heading,
    body: `${paragraphs.map(paragraph).join("")}${button(buttonLabel, buttonUrl)}${fallbackLink(buttonUrl)}${fine ? finePrint(fine) : ""}`,
  });
}

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
    ...(summary.serviceDate ? ["", `Funeral: ${formatServiceDate(summary.serviceDate)}`] : []),
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
    "What happens next:",
    `1. We print it. Our standard turnaround is ${STANDARD_TURNAROUND}.`,
    "2. We post it to you, to the address above, by the delivery you chose.",
    `3. Need to change something? Call us on ${PHONE_DISPLAY} (${OPENING_HOURS}) as soon as you can, or reply to this email.`,
    "",
    "With our sincere condolences,",
    "The Funeral Stationery",
  ].join("\n");
  const facts: Array<[string, string]> = [["Order number", summary.orderNumber]];
  if (summary.serviceDate) facts.push(["Funeral", formatServiceDate(summary.serviceDate)]);
  const html = brandedEmailHtml({
    preheader: `We've received your order ${summary.orderNumber} and payment. It's now queued for printing.`,
    heading: "Thank you for your order",
    body: `${paragraph(`Dear ${escapeHtml(summary.contactName)},`)}
${paragraph("We have received your order and payment. Your stationery is now queued for printing, exactly as you designed and confirmed it.")}
${factsBox(facts)}
${eyebrow("Your order")}
${orderTableHtml(summary)}
${eyebrow("Delivering to")}
${addressHtml(summary.addressLines)}
${button("View your order", orderUrl)}
${eyebrow("What happens next")}
${stepsHtml([
  ["We print it", `Our standard turnaround is ${escapeHtml(STANDARD_TURNAROUND)}.`],
  ["We post it to you", "To the address above, by the delivery you chose."],
  [
    "Need to change something?",
    `Call us on ${escapeHtml(PHONE_DISPLAY)} (${escapeHtml(OPENING_HOURS)}) as soon as you can, or reply to this email.`,
  ],
])}
${signOff("With our sincere condolences,")}`,
  });
  return { subject, text, html, replyTo: EMAIL, attachments: brandedAttachments() };
}

/** Sent to the business inbox so a new order isn't missed. */
export function orderNotificationEmail(
  summary: OrderEmailSummary,
  adminUrl: string,
): EmailContent {
  const subject = `New order ${summary.orderNumber} — ${formatPence(summary.totalPence)}`;
  const text = [
    `New paid order ${summary.orderNumber} from ${summary.contactName} <${summary.contactEmail}>.`,
    ...(summary.serviceDate ? ["", `Funeral: ${formatServiceDate(summary.serviceDate)}`] : []),
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
  const facts: Array<[string, string]> = [
    ["Order", summary.orderNumber],
    ["Total", formatPence(summary.totalPence)],
  ];
  if (summary.serviceDate) facts.push(["Funeral", formatServiceDate(summary.serviceDate)]);
  const html = brandedEmailHtml({
    preheader: `${summary.contactName} paid ${formatPence(summary.totalPence)} for ${summary.items.length === 1 ? "1 item" : `${summary.items.length} items`}.`,
    heading: "New paid order",
    body: `${paragraph(`From ${escapeHtml(summary.contactName)} &lt;<a href="mailto:${escapeHtml(summary.contactEmail)}" style="color:${PLUM}">${escapeHtml(summary.contactEmail)}</a>&gt;.`)}
${factsBox(facts)}
${eyebrow("Items")}
${orderTableHtml(summary)}
${eyebrow("Deliver to")}
${addressHtml(summary.addressLines)}
${button("Open in admin", adminUrl)}`,
  });
  return { subject, text, html, replyTo: summary.contactEmail, attachments: brandedAttachments() };
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
  const html = brandedEmailHtml({
    preheader: `Your order ${summary.orderNumber} has been cancelled and will not be printed.`,
    heading: "Your order has been cancelled",
    body: `${paragraph(`Dear ${escapeHtml(summary.contactName)},`)}
${paragraph(`Your order <strong>${escapeHtml(summary.orderNumber)}</strong> has been cancelled and will not be printed.`)}
${paragraph(`If a refund is due, it will go back to the card you paid with. If you didn&rsquo;t expect this, or have any questions, please call us on ${escapeHtml(PHONE_DISPLAY)} or email <a href="mailto:${escapeHtml(EMAIL)}" style="color:${PLUM}">${escapeHtml(EMAIL)}</a>.`)}
${eyebrow("The order")}
${orderTableHtml(summary)}
${button("View your order", orderUrl)}
${signOff("With our sincere condolences,")}`,
  });
  return { subject, text, html, replyTo: EMAIL, attachments: brandedAttachments() };
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
  const html = brandedEmailHtml({
    preheader: refundText,
    heading: "Order cancelled in Thintent",
    body: `${paragraph(`Order <strong>${escapeHtml(summary.orderNumber)}</strong> from ${escapeHtml(summary.contactName)} &lt;<a href="mailto:${escapeHtml(summary.contactEmail)}" style="color:${PLUM}">${escapeHtml(summary.contactEmail)}</a>&gt; was cancelled in Thintent.`)}
${paragraph(escapeHtml(refundText))}
${factsBox([
  ["Paid", formatPence(summary.totalPence)],
  ["Refunded so far", formatPence(refundedPence)],
])}
${button("Open in admin", adminUrl)}`,
  });
  return { subject, text, html, replyTo: summary.contactEmail, attachments: brandedAttachments() };
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
  const html = buttonEmailHtml({
    preheader: "Your one-time link to sign in. It expires in 15 minutes.",
    heading: "Your sign-in link",
    paragraphs: ["Use the button below to sign in and see the designs and orders saved to this email address."],
    buttonLabel: "Sign in",
    buttonUrl: linkUrl,
    finePrint: "The link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email — nothing has changed.",
  });
  return { subject, text, html, attachments: brandedAttachments() };
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
  const html = buttonEmailHtml({
    preheader: "Your one-time link to the admin area. It expires in 15 minutes.",
    heading: "Sign in to admin",
    paragraphs: [`Use the button below to sign in to the admin area of ${escapeHtml(SITE_NAME)}.`],
    buttonLabel: "Sign in to admin",
    buttonUrl: linkUrl,
    finePrint: "The link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email — nobody can sign in without it.",
  });
  return { subject, text, html, attachments: brandedAttachments() };
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
  const html = buttonEmailHtml({
    preheader: `${invitedBy} has given you access to the admin area.`,
    heading: "You've been given admin access",
    paragraphs: [
      `${escapeHtml(invitedBy)} has given this email address access to the admin area of ${escapeHtml(SITE_NAME)}.`,
      "To sign in, open the sign-in page and ask for a link. We&rsquo;ll email you a link that signs you in — there is no password.",
    ],
    buttonLabel: "Go to admin sign-in",
    buttonUrl: signInPageUrl,
  });
  return { subject, text, html, attachments: brandedAttachments() };
}

/**
 * The one email asking a family how we did, about two weeks after the
 * funeral (src/lib/reviewRequest.ts). Worded for someone grieving: thanks
 * first, one ask framed as helping other families, no obligation, never
 * "five stars". `optOutUrl` is the page that stops these for this address;
 * `oneClickUrl` is the same, for mail clients' own unsubscribe button
 * (RFC 8058), which POSTs to it directly.
 */
export function reviewRequestEmail({
  contactName,
  reviewUrl,
  optOutUrl,
  oneClickUrl,
}: {
  contactName: string;
  reviewUrl: string;
  optOutUrl: string;
  oneClickUrl: string;
}): EmailContent {
  const subject = `Thank you from ${SITE_NAME}`;
  const thanks =
    "Thank you for trusting us with the stationery for your loved one’s funeral. We hope everything was just as you wished on the day.";
  const ask =
    "If you feel comfortable sharing your experience, a few words on Google would help other families who are looking for someone to trust at a difficult time.";
  const noObligation = "There’s no obligation at all. We’re simply grateful we could help.";
  const onlyOne = "This is the only email we’ll send about your order.";
  const text = [
    `Dear ${contactName},`,
    "",
    thanks,
    "",
    ask,
    noObligation,
    "",
    reviewUrl,
    "",
    "With warm wishes,",
    SITE_NAME,
    "",
    `${onlyOne} To stop emails like this one: ${optOutUrl}`,
  ].join("\n");
  const html = brandedEmailHtml({
    preheader: "Thank you for letting us help. We hope everything was as you wished.",
    heading: "Thank you",
    body: `${paragraph(`Dear ${escapeHtml(contactName)},`)}
${paragraph(escapeHtml(thanks))}
${paragraph(escapeHtml(ask))}
${paragraph(escapeHtml(noObligation))}
${button("Share your experience on Google", reviewUrl)}
${signOff("With warm wishes,")}
${finePrint(`${escapeHtml(onlyOne)} <a href="${escapeHtml(optOutUrl)}" style="color:${LABEL}">Stop emails like this one</a>.`)}`,
  });
  return {
    subject,
    text,
    html,
    replyTo: EMAIL,
    attachments: brandedAttachments(),
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
