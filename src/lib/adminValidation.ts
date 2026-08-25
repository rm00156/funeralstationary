/**
 * Pure field validators for the /api/admin/* routes.
 *
 * Each parser takes the raw unknown from a JSON body and returns the
 * normalised value, or null when invalid — the route turns null into a 400.
 * Kept DB-free so it unit-tests without a database.
 */
import type {
  AdminOptionInput,
  AdminOptionPatch,
  OptionKind,
} from "@/lib/adminCatalogue.server";
import { MAX_PAGES } from "@/lib/designs.server";

/** Slugs are public identifiers and order-history snapshots — locked format. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 1 || value.length > 64) return null;
  return SLUG_RE.test(value) ? value : null;
}

export function parseLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 200 ? trimmed : null;
}

/** Optional free text (notes). Empty becomes null. */
export function parseNote(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 500) return undefined;
  return trimmed.length === 0 ? null : trimmed;
}

/** Integer pence, >= 0. */
export function parsePence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * Multiplier as the decimal(6,4) string the DB stores. Accepts a number,
 * requires 0 < m <= 99.9999 and at most 4 decimal places (so what the admin
 * typed is exactly what gets applied — no silent rounding).
 */
export function parseMultiplier(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 99.9999) return null;
  const fixed = value.toFixed(4);
  if (Number(fixed) !== value) return null;
  return fixed;
}

export function parseSortOrder(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 0 && value <= 32767 ? value : null;
}

export function parseBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Booklet page counts: even (folded sheets) and within the proof cap. */
export function parsePageCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 2 || value > MAX_PAGES || value % 2 !== 0) return null;
  return value;
}

export function parseCopies(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 100000 ? value : null;
}

export function parseHexColour(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export function parseTemplateStatus(value: unknown): TemplateStatus | null {
  return TEMPLATE_STATUSES.includes(value as TemplateStatus)
    ? (value as TemplateStatus)
    : null;
}

export function parseImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 1024) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return trimmed;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const usesMultiplier = (kind: OptionKind) =>
  kind === "size" || kind === "colour" || kind === "paper" || kind === "quantity";

/**
 * Full create payload for one pricing-option row. Which fields are required
 * depends on the table: size/colour/paper take a multiplier, quantity adds
 * copies, page-count takes pageCount + baseRatePence, delivery takes
 * pricePence and a mandatory note. Money crosses the wire as integer pence.
 */
export function parseOptionInput(
  kind: OptionKind,
  body: Record<string, unknown>,
): Parsed<AdminOptionInput> {
  const slug = parseSlug(body.slug);
  if (!slug) {
    return { ok: false, error: "slug must be 1-64 lowercase letters, digits and hyphens" };
  }
  const label = parseLabel(body.label);
  if (!label) return { ok: false, error: "label is required" };
  const note = parseNote(body.note);
  if (note === undefined && body.note !== undefined) {
    return { ok: false, error: "Invalid note" };
  }
  const sortOrder = body.sortOrder === undefined ? 0 : parseSortOrder(body.sortOrder);
  if (sortOrder === null) return { ok: false, error: "Invalid sortOrder" };

  const input: AdminOptionInput = { slug, label, note: note ?? null, sortOrder };

  if (usesMultiplier(kind)) {
    const multiplier = parseMultiplier(body.multiplier);
    if (!multiplier) {
      return { ok: false, error: "multiplier must be a number between 0 and 99.9999 (4dp max)" };
    }
    input.multiplier = multiplier;
  }
  if (kind === "quantity") {
    const copies = parseCopies(body.copies);
    if (copies === null) return { ok: false, error: "copies must be a whole number of at least 1" };
    input.copies = copies;
  }
  if (kind === "page-count") {
    const pageCount = parsePageCount(body.pageCount);
    if (pageCount === null) {
      return { ok: false, error: `pageCount must be an even number up to ${MAX_PAGES}` };
    }
    const baseRatePence = parsePence(body.baseRatePence);
    if (baseRatePence === null) {
      return { ok: false, error: "baseRatePence must be a whole number of pence" };
    }
    input.pageCount = pageCount;
    input.baseRatePence = baseRatePence;
  }
  if (kind === "delivery") {
    const pricePence = parsePence(body.pricePence);
    if (pricePence === null) {
      return { ok: false, error: "pricePence must be a whole number of pence" };
    }
    if (!input.note) return { ok: false, error: "Delivery options need a note" };
    input.pricePence = pricePence;
  }

  return { ok: true, value: input };
}

/** Partial edit payload for one pricing-option row — every field optional. */
export function parseOptionPatch(
  kind: OptionKind,
  body: Record<string, unknown>,
): Parsed<AdminOptionPatch> {
  const patch: AdminOptionPatch = {};

  if (body.label !== undefined) {
    const label = parseLabel(body.label);
    if (!label) return { ok: false, error: "Invalid label" };
    patch.label = label;
  }
  if (body.note !== undefined) {
    const note = parseNote(body.note);
    if (note === undefined) return { ok: false, error: "Invalid note" };
    if (kind === "delivery" && note === null) {
      return { ok: false, error: "Delivery options need a note" };
    }
    patch.note = note;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = parseSortOrder(body.sortOrder);
    if (sortOrder === null) return { ok: false, error: "Invalid sortOrder" };
    patch.sortOrder = sortOrder;
  }
  if (body.isActive !== undefined) {
    const isActive = parseBoolean(body.isActive);
    if (isActive === null) return { ok: false, error: "Invalid isActive" };
    patch.isActive = isActive;
  }
  if (body.multiplier !== undefined) {
    if (!usesMultiplier(kind)) return { ok: false, error: "This option has no multiplier" };
    const multiplier = parseMultiplier(body.multiplier);
    if (!multiplier) {
      return { ok: false, error: "multiplier must be a number between 0 and 99.9999 (4dp max)" };
    }
    patch.multiplier = multiplier;
  }
  if (body.copies !== undefined) {
    if (kind !== "quantity") return { ok: false, error: "Only quantity options have copies" };
    const copies = parseCopies(body.copies);
    if (copies === null) return { ok: false, error: "copies must be a whole number of at least 1" };
    patch.copies = copies;
  }
  if (body.pageCount !== undefined) {
    if (kind !== "page-count") return { ok: false, error: "Only page-count options have pageCount" };
    const pageCount = parsePageCount(body.pageCount);
    if (pageCount === null) {
      return { ok: false, error: `pageCount must be an even number up to ${MAX_PAGES}` };
    }
    patch.pageCount = pageCount;
  }
  if (body.baseRatePence !== undefined) {
    if (kind !== "page-count") {
      return { ok: false, error: "Only page-count options have baseRatePence" };
    }
    const baseRatePence = parsePence(body.baseRatePence);
    if (baseRatePence === null) {
      return { ok: false, error: "baseRatePence must be a whole number of pence" };
    }
    patch.baseRatePence = baseRatePence;
  }
  if (body.pricePence !== undefined) {
    if (kind !== "delivery") return { ok: false, error: "Only delivery options have pricePence" };
    const pricePence = parsePence(body.pricePence);
    if (pricePence === null) {
      return { ok: false, error: "pricePence must be a whole number of pence" };
    }
    patch.pricePence = pricePence;
  }

  return { ok: true, value: patch };
}

/**
 * A template layout payload: null (clear the authored layout) or 1..MAX_PAGES
 * structurally valid pages. Depth of checking mirrors validateDesignPayload —
 * page shape only, element internals are trusted from the editor.
 */
export function parseLayoutPages(
  value: unknown,
): { ok: true; pages: import("@/lib/designEditor").DesignPage[] | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, pages: null };
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "pages must be null or a non-empty array" };
  }
  if (value.length > MAX_PAGES) {
    return { ok: false, error: `A layout can have at most ${MAX_PAGES} pages` };
  }
  for (const page of value) {
    if (
      !page ||
      typeof page !== "object" ||
      typeof (page as { id?: unknown }).id !== "string" ||
      !Array.isArray((page as { elements?: unknown }).elements)
    ) {
      return { ok: false, error: "pages contains a malformed page" };
    }
  }
  return { ok: true, pages: value as import("@/lib/designEditor").DesignPage[] };
}

/** Category slugs for a template — unique, ordered (order becomes position). */
export function parseCategorySlugs(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const slugs: string[] = [];
  for (const entry of value) {
    const slug = parseSlug(entry);
    if (!slug || slugs.includes(slug)) return null;
    slugs.push(slug);
  }
  return slugs;
}
