/**
 * Server-side reads/writes for saved designs.
 *
 * Every query is scoped by owner — a design is only ever reachable by the
 * visitor who owns it. The one exception is adminFindDesign/adminWriteDesign,
 * for an admin editing a customer's design on their behalf (reached only
 * through adminDesigns.server.ts, behind isAdmin). Soft-deleted rows
 * (deleted_at) are excluded everywhere.
 *
 * The catalogue (templates/products/pricing options) uses surrogate int PKs,
 * but the rest of the app is entirely slug-based — URLs, src/lib/templates.ts,
 * the Selection type in orderOfServicePricing.ts. This module is the seam:
 * every write resolves an incoming slug to its surrogate id, and every read
 * joins back out to slugs, so nothing outside src/db ever sees a surrogate id.
 */
import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  designs,
  orderItems,
  orders,
  pageCountOptions,
  paperOptions,
  products,
  templates,
} from "@/db/schema";
import { A5_TRIM, docTrim, sameTrim, type DesignDoc, type PageTrim } from "@/lib/designEditor";
import { changesContent } from "@/lib/designRevision";
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
  templateName: string;
  /** The template's preview artwork — the closest thing to a design thumbnail. */
  templateImage: string;
  productId: string;
  productLabel: string;
  doc: DesignDoc;
  pagesOptionId: string;
  paperId: string;
  pageCount: number;
  /** Bumped on every save — see designs.revision. */
  revision: number;
  updatedAt: Date;
}

/** A save made from an out-of-date copy of the design (see designs.revision). */
export class DesignConflictError extends Error {
  constructor() {
    super("This design was changed somewhere else");
  }
}

/** Owner predicate: a signed-in customer by user_id, a guest by guest_token. */
function ownedBy(owner: Owner) {
  return owner.userId === null
    ? eq(designs.guestToken, owner.guestToken)
    : eq(designs.userId, owner.userId);
}

function isLiveDesign() {
  return isNull(designs.deletedAt);
}

/**
 * Validate an incoming document before it reaches the database.
 *
 * The page-count invariant matters: setPageCount() in the editor calls
 * withPageCount(), so doc.pages.length must always equal the chosen page
 * option's `pages` (the caller resolves the option row via
 * getPageCountOption and passes its pageCount). MySQL CHECK constraints
 * can't reach another table, so this is the enforcement point. Option
 * existence itself is enforced by the DB resolvers in this module.
 */
export function validateDesignPayload(
  doc: unknown,
  expectedPages: number,
  /** The product's trim. A doc is laid out on one size and must stay its product's. */
  expectedTrim: PageTrim = A5_TRIM,
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

  if (candidate.pages.length !== expectedPages) {
    return {
      ok: false,
      error: `doc.pages has ${candidate.pages.length} pages but the chosen page option expects ${expectedPages}`,
    };
  }

  // A doc with no trim predates formats and is A5, so an old booklet design
  // still saves; anything else must be laid out on its product's own size.
  const trim = docTrim(candidate);
  if (
    typeof trim.widthMm !== "number" ||
    typeof trim.heightMm !== "number" ||
    !sameTrim(trim, expectedTrim)
  ) {
    return {
      ok: false,
      error: `doc is laid out at ${trim.widthMm} × ${trim.heightMm} mm but this product is ${expectedTrim.widthMm} × ${expectedTrim.heightMm} mm`,
    };
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
    revision: designs.revision,
    updatedAt: designs.updatedAt,
    templateSlug: templates.slug,
    templateName: templates.name,
    templateImage: templates.previewImageUrl,
    productSlug: products.slug,
    productLabel: products.label,
    pageCountSlug: pageCountOptions.slug,
    paperSlug: paperOptions.slug,
  };
}

type SelectedRow = {
  id: string;
  name: string;
  doc: DesignDoc;
  pageCount: number;
  revision: number;
  updatedAt: Date;
  templateSlug: string;
  templateName: string;
  templateImage: string;
  productSlug: string;
  productLabel: string;
  pageCountSlug: string;
  paperSlug: string;
};

function toSavedDesign(row: SelectedRow): SavedDesign {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateSlug,
    templateName: row.templateName,
    templateImage: row.templateImage,
    productId: row.productSlug,
    productLabel: row.productLabel,
    doc: row.doc,
    pagesOptionId: row.pageCountSlug,
    paperId: row.paperSlug,
    pageCount: row.pageCount,
    revision: row.revision,
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

/** One live design within `scope` — an owner's, or (admin) anyone's. */
async function findDesign(scope: SQL | undefined, id: string): Promise<SavedDesign | null> {
  const rows = await db
    .select(savedDesignSelection())
    .from(designs)
    .innerJoin(templates, eq(designs.templateId, templates.id))
    .innerJoin(products, eq(designs.productId, products.id))
    .innerJoin(pageCountOptions, eq(designs.pageCountOptionId, pageCountOptions.id))
    .innerJoin(paperOptions, eq(designs.paperOptionId, paperOptions.id))
    .where(and(eq(designs.id, id), scope, isLiveDesign()))
    .limit(1);
  return rows[0] ? toSavedDesign(rows[0]) : null;
}

export async function getDesign(owner: Owner, id: string): Promise<SavedDesign | null> {
  return findDesign(ownedBy(owner), id);
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

async function getDesignProductId(scope: SQL | undefined, id: string): Promise<number | null> {
  const [row] = await db
    .select({ productId: designs.productId })
    .from(designs)
    .where(and(eq(designs.id, id), scope, isLiveDesign()))
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

export interface DesignPatch {
  doc?: DesignDoc;
  spec?: DesignSpec;
  name?: string;
  /** Slug — set when the editor applies a different template to the cover. */
  templateId?: string;
}

/**
 * Save changes to one of `owner`'s designs. A change to its content (see
 * changesContent) bumps the revision; with `expectedRevision` it only lands on
 * that revision and throws DesignConflictError otherwise, and without it (an
 * editor tab opened before revisions existed) it is unconditional. A rename
 * alone neither checks nor bumps the revision, so renaming on /account never
 * makes an open editor's next save look like a clash.
 */
export async function updateDesign(
  owner: Owner,
  id: string,
  patch: DesignPatch,
  expectedRevision?: number,
): Promise<SavedDesign | null> {
  return writeDesign(ownedBy(owner), id, patch, expectedRevision);
}

/**
 * Any customer's design, for an admin editing it on their behalf. Only
 * adminDesigns.server.ts and the /api/admin/designs routes (behind isAdmin)
 * call these — every customer path goes through the owner-scoped functions
 * above.
 */
export function adminFindDesign(id: string): Promise<SavedDesign | null> {
  return findDesign(undefined, id);
}

export function adminWriteDesign(
  id: string,
  patch: DesignPatch,
  expectedRevision?: number,
): Promise<SavedDesign | null> {
  return writeDesign(undefined, id, patch, expectedRevision);
}

async function writeDesign(
  scope: SQL | undefined,
  id: string,
  patch: DesignPatch,
  expectedRevision: number | undefined,
): Promise<SavedDesign | null> {
  const productId = await getDesignProductId(scope, id);
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

  const content = changesContent(patch);
  const guarded = content && expectedRevision !== undefined;
  const [result] = await db
    .update(designs)
    .set({
      ...(patch.doc ? { doc: patch.doc } : {}),
      ...(patch.spec ? { pageCountOptionId, paperOptionId } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(templateId !== undefined ? { templateId } : {}),
      ...(content ? { revision: sql`${designs.revision} + 1` } : {}),
    })
    .where(
      and(
        eq(designs.id, id),
        scope,
        isLiveDesign(),
        guarded ? eq(designs.revision, expectedRevision) : undefined,
      ),
    );

  if (result.affectedRows === 0) {
    // Not there, not at that revision — or a rename to the name it already
    // had, which matches the row but changes nothing. (A content change bumps
    // the revision, so a matched row always changes.)
    const current = await findDesign(scope, id);
    if (current && guarded) throw new DesignConflictError();
    return current;
  }
  const updated = await findDesign(scope, id);
  // Re-read after the write, so another write may have landed in between:
  // report the revision this one made, or the editor would take on the
  // other's and its next save would pass the guard over that change.
  return updated && guarded ? { ...updated, revision: expectedRevision + 1 } : updated;
}

/**
 * Soft delete — the row survives so any *placed* order that referenced it
 * still reads. Lines in a still-draft order (the basket) are dropped instead:
 * a basket line for a design the customer just removed can never be paid
 * for. (Done here rather than in orders.server.ts, which imports this module.)
 */
export async function deleteDesign(owner: Owner, id: string): Promise<boolean> {
  const existing = await getDesign(owner, id);
  if (!existing) return false;
  await db
    .update(designs)
    .set({ deletedAt: new Date() })
    .where(and(eq(designs.id, id), ownedBy(owner), isLiveDesign()));
  await db.delete(orderItems).where(
    and(
      eq(orderItems.designId, id),
      inArray(
        orderItems.orderId,
        db.select({ id: orders.id }).from(orders).where(eq(orders.status, "draft")),
      ),
    ),
  );
  return true;
}
