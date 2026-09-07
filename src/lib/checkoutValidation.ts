/**
 * Pure field validators for the checkout form (POST /api/checkout).
 *
 * Same contract as adminValidation.ts: each parser takes the raw unknown
 * from a JSON body and returns the normalised value, or null when invalid;
 * optional fields follow parseNote's convention (null = absent, undefined =
 * invalid). Kept DB-free so it unit-tests without a database.
 */

export interface CheckoutDetails {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
}

function trimmedWithin(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

/** Deliberately loose — the mailbox is what matters, Stripe re-validates. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 255) return null;
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

export function parseName(value: unknown): string | null {
  return trimmedWithin(value, 1, 200);
}

/** Optional. Digits with the usual separators; 7–15 digits in total. */
export function parsePhone(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return null;
  if (trimmed.length > 50 || !/^[\d\s+().-]+$/.test(trimmed)) return undefined;
  const digits = trimmed.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? trimmed : undefined;
}

export function parseAddressLine(value: unknown): string | null {
  return trimmedWithin(value, 1, 255);
}

/** Optional second address line. */
export function parseOptionalAddressLine(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return null;
  return trimmed.length <= 255 ? trimmed : undefined;
}

export function parseCity(value: unknown): string | null {
  return trimmedWithin(value, 1, 120);
}

/**
 * UK postcode, permissively: any outward code of 2–4 alphanumerics followed
 * by digit + two letters. Normalised to upper case with the single standard
 * space ("sw1a1aa" -> "SW1A 1AA"). Delivery is UK-only (orders.country = GB).
 */
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

export function parseUkPostcode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (!UK_POSTCODE_RE.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** The whole checkout form; the first invalid field names itself in the error. */
export function parseCheckoutDetails(body: unknown): Parsed<CheckoutDetails> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const contactName = parseName(raw.contactName);
  if (!contactName) return { ok: false, error: "Please enter your name" };

  const contactEmail = parseEmail(raw.contactEmail);
  if (!contactEmail) return { ok: false, error: "Please enter a valid email address" };

  const contactPhone = parsePhone(raw.contactPhone);
  if (contactPhone === undefined) return { ok: false, error: "Please enter a valid phone number" };

  const addressLine1 = parseAddressLine(raw.addressLine1);
  if (!addressLine1) return { ok: false, error: "Please enter the first line of your address" };

  const addressLine2 = parseOptionalAddressLine(raw.addressLine2);
  if (addressLine2 === undefined) return { ok: false, error: "The second address line is too long" };

  const city = parseCity(raw.city);
  if (!city) return { ok: false, error: "Please enter your town or city" };

  const postcode = parseUkPostcode(raw.postcode);
  if (!postcode) return { ok: false, error: "Please enter a valid UK postcode" };

  return {
    ok: true,
    value: { contactName, contactEmail, contactPhone, addressLine1, addressLine2, city, postcode },
  };
}
