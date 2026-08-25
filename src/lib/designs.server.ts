/**
 * Server-side reads/writes for saved designs.
 *
 * Every query is scoped by owner — a design is only ever reachable by the
 * visitor who owns it. Soft-deleted rows (deleted_at) are excluded everywhere.
 *
 * The catalogue (templates/products/pricing options) uses surrogate int PKs,
 * but the rest of the app is entirely slug-based — URLs, src/lib/templates.ts,
 * the Selection type in orderOfServicePricing.ts. This module is the seam:
 * every write resolves an incoming slug to its surrogate id, and every read
 * joins back out to slugs, so nothing outside src/db ever sees a surrogate id.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { designs, pageCountOptions, paperOptions, products, templates } from "@/db/schema";
import type { DesignDoc } from "@/lib/designEditor";
import { PAGE_OPTIONS, PAPER_OPTIONS } from "@/lib/orderOfServicePricing";
import type { Owner } from "@/lib/session";

/** Max pages a doc may carry — mirrors the proof route's MAX_PAGES. */
export const MAX_PAGES = 24;

export interface DesignSpec {
  pagesOptionId: string;
  paperId: string;
}

export interface SavedDesign {
  id: string;
  name: string;
  templateId: string;
  productId: string;
  doc: DesignDoc;
  pagesOptionId: string;
  paperId: string;
  pageCount: number;
  updatedAt: Date;
}

/** Owner predicate. Falls back to the guest token until accounts exist. */
function ownedBy(owner: Owner) {
  return owner.userId
    ? eq(designs.userId, owner.userId)
    : eq(designs.guestToken, owner.guestToken);
}

function isLiveDesign() {
  return isNull(designs.deletedAt);
}

/**
 * Validate an incoming document before it reaches the database.
 *
 * The page-count invariant matters: setPageCount() in the editor calls
 * withPageCount(), so doc.pages.length must always equal the chosen page
 * option's `pages`. MySQL CHECK constraints can't reach another table, so
 * this is the enforcement point.
 */
export function validateDesignPayload(
  doc: unknown,
  spec: DesignSpec,
): { ok: true; doc: DesignDoc } | { ok: false; error: string } {
  if (!doc || typeof doc !== "object") return { ok: false, error: "doc is required" };
  const candidate = doc as DesignDoc;
  if (!Array.isArray(candidate.pages) || candidate.pages.length === 0) {
    return { ok: false, error: "doc.pages is required" };
  }
  if (candidate.pages.length > MAX_PAGES) {
    return { ok: false, error: `A design can have at most ${MAX_PAGES} pages` };
  }
  if (typeof candidate.templateId !== "string" || !candidate.templateId) {
    return { ok: false, error: "doc.templateId is required" };
  }
  for (const page of candidate.pages) {
    if (!page || typeof page.id !== "string" || !Array.isArray(page.elements)) {
      return { ok: false, error: "doc.pages contains a malformed page" };
    }
  }

  const pageOption = PAGE_OPTIONS.find((option) => option.id === spec.pagesOptionId);
  if (!pageOption) return { ok: false, error: "Unknown page count option" };
  if (pageOption.pages !== candidate.pages.length) {
    return {
      ok: false,
      error: `doc.pages has ${candidate.pages.length} pages but the "${pageOption.label}" option expects ${pageOption.pages}`,
    };
  }
  if (!PAPER_OPTIONS.some((option) => option.id === spec.paperId)) {
    return { ok: false, error: "Unknown paper option" };
  }

  return { ok: true, doc: candidate };
}

/** The joined shape every read maps into a slug-based SavedDesign. */
function savedDesignSelection() {
  return {
    id: designs.id,
    name: designs.name,
    doc: designs.doc,
    pageCount: designs.pageCount,
    updatedAt: designs.updatedAt,
    templateSlug: templates.slug,
    productSlug: products.slug,
    pageCountSlug: pageCountOptions.slug,
    paperSlug: paperOptions.slug,
  };
}

type SelectedRow = {
  id: string;
  name: string;
  doc: DesignDoc;
  pageCount: number;
  updatedAt: Date;
  templateSlug: string;
  productSlug: string;
  pageCountSlug: string;
  paperSlug: string;
};

function toSavedDesign(row: SelectedRow): SavedDesign {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateSlug,
    productId: row.productSlug,
    doc: row.doc,
    pagesOptionId: row.pageCountSlug,
    paperId: row.paperSlug,
    pageCount: row.pageCount,
    updatedAt: row.updatedAt,
  };
}

export async function listDesigns(owner: Owner): Promise<SavedDesign[]> {
  const rows = await db
    .select(savedDesignSelection())
    .from(designs)
    .innerJoin(templates, eq(designs.templateId, templates.id))
    .innerJoin(products, eq(designs.productId, products.id))
    .innerJoin(pageCountOptions, eq(designs.pageCountOptionId, pageCountOptions.id))
    .innerJoin(paperOptions, eq(designs.paperOptionId, paperOptions.id))
    .where(and(ownedBy(owner), isLiveDesign()))
    .orderBy(desc(designs.updatedAt));
  return rows.map(toSavedDesign);
}

export async function getDesign(owner: Owner, id: string): Promise<SavedDesign | null> {
  const rows = await db
    .select(savedDesignSelection())
    .from(designs)
    .innerJoin(templates, eq(designs.templateId, templates.id))
    .innerJoin(products, eq(designs.productId, products.id))
    .innerJoin(pageCountOptions, eq(designs.pageCountOptionId, pageCountOptions.id))
    .innerJoin(paperOptions, eq(designs.paperOptionId, paperOptions.id))
    .where(and(eq(designs.id, id), ownedBy(owner), isLiveDesign()))
    .limit(1);
  return rows[0] ? toSavedDesign(rows[0]) : null;
}

async function resolveProductId(slug: string): Promise<number | null> {
  const [row] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  return row?.id ?? null;
}

async function resolveTemplateId(slug: string): Promise<number | null> {
  const [row] = await db.select({ id: templates.id }).from(templates).where(eq(templates.slug, slug)).limit(1);
  return row?.id ?? null;
}

async function resolvePageCountOptionId(productId: number, slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: pageCountOptions.id })
    .from(pageCountOptions)
    .where(and(eq(pageCountOptions.productId, productId), eq(pageCountOptions.slug, slug)))
    .limit(1);
  return row?.id ?? null;
}

async function resolvePaperOptionId(productId: number, slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: paperOptions.id })
    .from(paperOptions)
    .where(and(eq(paperOptions.productId, productId), eq(paperOptions.slug, slug)))
    .limit(1);
  return row?.id ?? null;
}

async function getOwnedDesignProductId(owner: Owner, id: string): Promise<number | null> {
  const [row] = await db
    .select({ productId: designs.productId })
    .from(designs)
    .where(and(eq(designs.id, id), ownedBy(owner), isLiveDesign()))
    .limit(1);
  return row?.productId ?? null;
}

export async function createDesign(
  owner: Owner,
  input: {
    templateId: string;
    productId: string;
    name: string;
    doc: DesignDoc;
    spec: DesignSpec;
  },
): Promise<SavedDesign> {
  const productId = await resolveProductId(input.productId);
  const templateId = await resolveTemplateId(input.templateId);
  if (!productId) throw new Error(`Unknown product "${input.productId}"`);
  if (!templateId) throw new Error(`Unknown template "${input.templateId}"`);

  const pageCountOptionId = await resolvePageCountOptionId(productId, input.spec.pagesOptionId);
  const paperOptionId = await resolvePaperOptionId(productId, input.spec.paperId);
  if (!pageCountOptionId) {
    throw new Error(`Unknown page count option "${input.spec.pagesOptionId}" for "${input.productId}"`);
  }
  if (!paperOptionId) {
    throw new Error(`Unknown paper option "${input.spec.paperId}" for "${input.productId}"`);
  }

  const id = crypto.randomUUID();
  await db.insert(designs).values({
    id,
    userId: owner.userId,
    guestToken: owner.userId ? null : owner.guestToken,
    templateId,
    productId,
    name: input.name,
    doc: input.doc,
    pageCountOptionId,
    paperOptionId,
  });
  const created = await getDesign(owner, id);
  if (!created) throw new Error("Design vanished immediately after insert");
  return created;
}

export async function updateDesign(
  owner: Owner,
  id: string,
  patch: {
    doc?: DesignDoc;
    spec?: DesignSpec;
    name?: string;
    /** Slug — set when the editor applies a different template to the cover. */
    templateId?: string;
  },
): Promise<SavedDesign | null> {
  const productId = await getOwnedDesignProductId(owner, id);
  if (!productId) return null;

  let pageCountOptionId: number | undefined;
  let paperOptionId: number | undefined;
  if (patch.spec) {
    const resolvedPageCount = await resolvePageCountOptionId(productId, patch.spec.pagesOptionId);
    const resolvedPaper = await resolvePaperOptionId(productId, patch.spec.paperId);
    if (!resolvedPageCount) throw new Error(`Unknown page count option "${patch.spec.pagesOptionId}"`);
    if (!resolvedPaper) throw new Error(`Unknown paper option "${patch.spec.paperId}"`);
    pageCountOptionId = resolvedPageCount;
    paperOptionId = resolvedPaper;
  }

  let templateId: number | undefined;
  if (patch.templateId !== undefined) {
    const resolved = await resolveTemplateId(patch.templateId);
    if (!resolved) throw new Error(`Unknown template "${patch.templateId}"`);
    templateId = resolved;
  }

  await db
    .update(designs)
    .set({
      ...(patch.doc ? { doc: patch.doc } : {}),
      ...(patch.spec ? { pageCountOptionId, paperOptionId } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(templateId !== undefined ? { templateId } : {}),
    })
    .where(and(eq(designs.id, id), ownedBy(owner), isLiveDesign()));

  return getDesign(owner, id);
}

/** Soft delete — the row survives so any order that referenced it still reads. */
export async function deleteDesign(owner: Owner, id: string): Promise<boolean> {
  const existing = await getDesign(owner, id);
  if (!existing) return false;
  await db
    .update(designs)
    .set({ deletedAt: new Date() })
    .where(and(eq(designs.id, id), ownedBy(owner), isLiveDesign()));
  return true;
}
