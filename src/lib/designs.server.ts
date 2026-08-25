/**
 * Server-side reads/writes for saved designs.
 *
 * Every query is scoped by owner — a design is only ever reachable by the
 * visitor who owns it. Soft-deleted rows (deleted_at) are excluded everywhere.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { designs } from "@/db/schema";
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

export async function listDesigns(owner: Owner): Promise<SavedDesign[]> {
  const rows = await db
    .select()
    .from(designs)
    .where(and(ownedBy(owner), isLiveDesign()))
    .orderBy(desc(designs.updatedAt));
  return rows.map(toSavedDesign);
}

export async function getDesign(owner: Owner, id: string): Promise<SavedDesign | null> {
  const [row] = await db
    .select()
    .from(designs)
    .where(and(eq(designs.id, id), ownedBy(owner), isLiveDesign()))
    .limit(1);
  return row ? toSavedDesign(row) : null;
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
  const id = crypto.randomUUID();
  await db.insert(designs).values({
    id,
    userId: owner.userId,
    guestToken: owner.userId ? null : owner.guestToken,
    templateId: input.templateId,
    productId: input.productId,
    name: input.name,
    doc: input.doc,
    pageCountOptionId: input.spec.pagesOptionId,
    paperOptionId: input.spec.paperId,
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
  },
): Promise<SavedDesign | null> {
  const existing = await getDesign(owner, id);
  if (!existing) return null;

  await db
    .update(designs)
    .set({
      ...(patch.doc ? { doc: patch.doc } : {}),
      ...(patch.spec
        ? {
            pageCountOptionId: patch.spec.pagesOptionId,
            paperOptionId: patch.spec.paperId,
          }
        : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
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

type DesignRow = typeof designs.$inferSelect;

function toSavedDesign(row: DesignRow): SavedDesign {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    productId: row.productId,
    doc: row.doc,
    pagesOptionId: row.pageCountOptionId,
    paperId: row.paperOptionId,
    pageCount: row.pageCount,
    updatedAt: row.updatedAt,
  };
}
