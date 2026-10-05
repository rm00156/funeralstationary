/**
 * The contact form's pure half: its topic list and the validation of a
 * submitted message. DB- and network-free so it unit-tests on its own (same
 * discipline as adminValidation.ts); POST /api/contact is the only caller
 * that sends anything.
 */

/**
 * The topics that aren't a product. The form's select lists every sellable
 * product first (by slug), then these — so "?topic=order-of-service" and
 * "?topic=upload" both preselect.
 */
export const CONTACT_TOPICS = [
  { id: "design-for-me", label: "Designing it for me" },
  { id: "upload", label: "Uploading my own design" },
  { id: "existing-order", label: "An existing order" },
  { id: "something-else", label: "Something else" },
] as const;

export const DEFAULT_CONTACT_TOPIC = "something-else";

export interface ContactMessage {
  name: string;
  email: string;
  phone: string | null;
  /** The topic's label as the customer saw it — this is what the email shows. */
  topic: string;
  /** ISO yyyy-mm-dd, or null when not given. */
  serviceDate: string | null;
  message: string;
}

export type ContactField = "name" | "email" | "phone" | "topic" | "serviceDate" | "message";

export type ContactResult =
  | { ok: true; message: ContactMessage }
  | { ok: false; errors: Partial<Record<ContactField, string>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** True for a real calendar date written yyyy-mm-dd (so not 2026-02-31). */
function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Validate a submitted form. `topics` maps every topic id the form offered to
 * its label (products included), so an id the page never rendered is rejected
 * rather than echoed into an email.
 */
export function validateContactMessage(
  input: unknown,
  topics: ReadonlyMap<string, string>,
): ContactResult {
  const body = (input ?? {}) as Record<string, unknown>;
  const errors: Partial<Record<ContactField, string>> = {};

  const name = text(body.name);
  if (!name) errors.name = "Please tell us your name.";
  else if (name.length > 120) errors.name = "That name is too long.";

  const email = text(body.email);
  if (!email) errors.email = "Please give us an email address to reply to.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) {
    errors.email = "That email address doesn’t look right.";
  }

  const phone = text(body.phone);
  if (phone.length > 40) errors.phone = "That phone number is too long.";

  const topic = topics.get(text(body.topic));
  if (!topic) errors.topic = "Please choose what your message is about.";

  const serviceDate = text(body.serviceDate);
  if (serviceDate && !isCalendarDate(serviceDate)) {
    errors.serviceDate = "Please enter the date as day, month and year.";
  }

  const message = text(body.message);
  if (!message) errors.message = "Please write your message.";
  else if (message.length > 5000) errors.message = "Please keep your message under 5,000 characters.";

  if (Object.keys(errors).length > 0 || !topic) return { ok: false, errors };
  return {
    ok: true,
    message: { name, email, phone: phone || null, topic, serviceDate: serviceDate || null, message },
  };
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** yyyy-mm-dd → "Friday 9 October 2026", for a person reading the email. */
export function formatServiceDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** The email the business receives. Everything the customer typed is escaped. */
export function contactEmail(message: ContactMessage): {
  subject: string;
  text: string;
  html: string;
} {
  const rows: [string, string][] = [
    ["Name", message.name],
    ["Email", message.email],
    ["Phone", message.phone ?? "Not given"],
    ["About", message.topic],
    ["Date of the service", message.serviceDate ? formatServiceDate(message.serviceDate) : "Not given"],
  ];
  // Header fields must stay on one line.
  const subject = `Website enquiry: ${message.topic} — ${message.name}`.replace(/[\r\n]+/g, " ");
  return {
    subject,
    text: `${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${message.message}\n`,
    html: `<table cellpadding="4">${rows
      .map(
        ([label, value]) =>
          `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("")}</table><p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>`,
  };
}
