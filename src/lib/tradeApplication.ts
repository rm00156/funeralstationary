/**
 * The trade-account application on /trade: its choices and the validation of
 * a submitted form. DB- and network-free so it unit-tests on its own (same
 * discipline as contact.ts); POST /api/trade is the only caller that sends
 * anything.
 *
 * Applying creates nothing. A trade account is set up by a person, who gets
 * in touch with the firm, so the application is simply emailed to the business.
 */
import { escapeHtml, isReplyToAddress } from "@/lib/contact";

/** "Roughly how many funerals a month?" — the first is the select's default. */
export const FUNERAL_VOLUMES = [
  { id: "under-5", label: "Fewer than 5" },
  { id: "5-15", label: "5 to 15" },
  { id: "16-30", label: "16 to 30" },
  { id: "over-30", label: "More than 30" },
] as const;

/**
 * "Your role" — a short list is quicker to answer, and gives the shop
 * answers it can sort by. "Other" opens a box for the applicant's own words.
 */
export const TRADE_ROLES = [
  { id: "owner", label: "Owner or director" },
  { id: "funeral-director", label: "Funeral director" },
  { id: "arranger", label: "Funeral arranger" },
  { id: "office", label: "Office or admin" },
  { id: "celebrant", label: "Celebrant or officiant" },
  { id: "other", label: "Other" },
] as const;

/** The "What do you usually order?" box that isn't a product. */
export const OTHER_ORDER_TYPE = { id: "something-else", label: "Something else" } as const;

export interface TradeChoice {
  id: string;
  label: string;
}

/**
 * The "What do you usually order?" boxes: every sellable product (by slug),
 * then "Something else". The page and the route both build the list here, so
 * the server never rejects a box the page showed. A product whose slug
 * collides with the fixed id is left out rather than shadowing it.
 */
export function tradeOrderTypes(products: readonly TradeChoice[]): TradeChoice[] {
  return [
    ...products
      .filter(({ id }) => id !== OTHER_ORDER_TYPE.id)
      .map(({ id, label }) => ({ id, label })),
    { ...OTHER_ORDER_TYPE },
  ];
}

export interface TradeApplication {
  businessName: string;
  postcode: string;
  name: string;
  /** The role's label, or the applicant's own words when they chose Other. */
  role: string;
  email: string;
  phone: string;
  /** The volume's label as the applicant saw it — this is what the email shows. */
  volume: string;
  /** Labels of the boxes ticked, in the order the form listed them. */
  orders: string[];
  notes: string | null;
}

export type TradeField =
  | "businessName"
  | "postcode"
  | "name"
  | "role"
  | "roleOther"
  | "email"
  | "phone"
  | "volume"
  | "orders"
  | "notes";

export type TradeResult =
  | { ok: true; application: TradeApplication }
  | { ok: false; errors: Partial<Record<TradeField, string>> };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** A required single-line field: present and no longer than `max`. */
function line(
  value: unknown,
  max: number,
  missing: string,
  tooLong: string,
): { value: string; error?: string } {
  const result = text(value);
  if (!result) return { value: result, error: missing };
  if (result.length > max) return { value: result, error: tooLong };
  return { value: result };
}

/**
 * Validate a submitted application. `orderTypes` is the list of boxes the form
 * offered (products included), so an id the page never rendered is rejected
 * rather than echoed into an email.
 */
export function validateTradeApplication(
  input: unknown,
  orderTypes: readonly TradeChoice[],
): TradeResult {
  const body = (input ?? {}) as Record<string, unknown>;
  const errors: Partial<Record<TradeField, string>> = {};

  const fields = {
    businessName: line(body.businessName, 160, "Please tell us your business name.", "That business name is too long."),
    postcode: line(body.postcode, 10, "Please tell us your postcode.", "That postcode doesn’t look right."),
    name: line(body.name, 120, "Please tell us your name.", "That name is too long."),
    phone: line(body.phone, 40, "Please give us a phone number.", "That phone number is too long."),
  };
  for (const [field, { error }] of Object.entries(fields)) {
    if (error) errors[field as TradeField] = error;
  }

  const roleChoice = TRADE_ROLES.find(({ id }) => id === text(body.role));
  let role = roleChoice?.label ?? "";
  if (!roleChoice) errors.role = "Please choose your role.";
  else if (roleChoice.id === "other") {
    const own = line(body.roleOther, 120, "Please tell us your role.", "That role is too long.");
    if (own.error) errors.roleOther = own.error;
    role = own.value;
  }

  const email = text(body.email);
  if (!email) errors.email = "Please give us an email address to reply to.";
  else if (!isReplyToAddress(email)) errors.email = "That email address doesn’t look right.";

  const volume = FUNERAL_VOLUMES.find(({ id }) => id === text(body.volume));
  if (!volume) errors.volume = "Please choose roughly how many funerals you arrange a month.";

  // One ticked box arrives as a string, several as an array, none as nothing.
  const ticked = new Set(
    (Array.isArray(body.orders) ? body.orders : body.orders == null ? [] : [body.orders]).map(text),
  );
  const known = orderTypes.filter(({ id }) => ticked.has(id));
  if (known.length !== ticked.size) errors.orders = "Please choose from the options shown.";

  const notes = text(body.notes);
  if (notes.length > 5000) errors.notes = "Please keep this under 5,000 characters.";

  if (Object.keys(errors).length > 0 || !volume) return { ok: false, errors };
  return {
    ok: true,
    application: {
      businessName: fields.businessName.value,
      postcode: fields.postcode.value.toUpperCase(),
      name: fields.name.value,
      role,
      email,
      phone: fields.phone.value,
      volume: volume.label,
      orders: known.map(({ label }) => label),
      notes: notes || null,
    },
  };
}

/** The firm an applicant's email is already on, if any — for staff, never the applicant. */
export interface ExistingTradeFirm {
  firmName: string;
  isActive: boolean;
}

/**
 * The email the business receives. Everything the applicant typed is escaped.
 * When the address is already on a firm, the email says so (and its subject
 * does, so it sorts from new leads in the inbox); the applicant is told
 * nothing different, so the form can't be used to look addresses up.
 */
export function tradeApplicationEmail(
  application: TradeApplication,
  existing: ExistingTradeFirm | null = null,
  /** /admin/trade, where it is approved or declined. */
  reviewUrl: string | null = null,
): {
  subject: string;
  text: string;
  html: string;
} {
  const already = existing && `${existing.firmName}${existing.isActive ? "" : " (retired)"}`;
  const rows: [string, string][] = [
    ...(already ? ([["Already a trade customer", `This email is on ${already}`]] as [string, string][]) : []),
    ["Business", application.businessName],
    ["Postcode", application.postcode],
    ["Name", application.name],
    ["Role", application.role],
    ["Email", application.email],
    ["Phone", application.phone],
    ["Funerals a month", application.volume],
    ["Usually orders", application.orders.length > 0 ? application.orders.join(", ") : "Not given"],
  ];
  // Header fields must stay on one line.
  const subject =
    `Trade account application: ${application.businessName} — ${application.name}${
      already ? ` (already on ${already})` : ""
    }`.replace(
      /[\r\n]+/g,
      " ",
    );
  const notes = application.notes ?? "";
  const review = reviewUrl ? `\nApprove or decline it in admin: ${reviewUrl}\n` : "";
  return {
    subject,
    text: `${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n${notes ? `\n${notes}\n` : ""}${review}`,
    html: `<table cellpadding="4">${rows
      .map(
        ([label, value]) =>
          `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("")}</table>${notes ? `<p style="white-space:pre-wrap">${escapeHtml(notes)}</p>` : ""}${
      reviewUrl ? `<p><a href="${escapeHtml(reviewUrl)}">Approve or decline it in admin</a></p>` : ""
    }`,
  };
}
