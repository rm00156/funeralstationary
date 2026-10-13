/**
 * The body of a design save (PATCH), shared by the customer's route and the
 * admin's, so a design edited on a customer's behalf passes exactly the
 * checks the customer's own save would. Only who may reach the row differs —
 * that is the `write` each route passes in.
 */
import { getProductFormats, templateProductSlug } from "@/lib/catalogue.server";
import { BOOKLET_FORMAT } from "@/lib/designEditor";
import { DESIGN_CONFLICT_REASON, parseExpectedRevision } from "@/lib/designRevision";
import {
  DesignConflictError,
  validateDesignPayload,
  type DesignPatch,
  type SavedDesign,
} from "@/lib/designs.server";
import { getPageCountOption } from "@/lib/pricing.server";

export async function saveDesignPatch(
  body: unknown,
  existing: SavedDesign,
  write: (patch: DesignPatch, expectedRevision?: number) => Promise<SavedDesign | null>,
): Promise<Response> {
  const { doc, pagesOptionId, paperId, name, templateId, revision } = (body ?? {}) as Record<
    string,
    unknown
  >;

  const expectedRevision = parseExpectedRevision(revision);
  if (expectedRevision === "invalid") {
    return Response.json({ error: "Invalid revision" }, { status: 400 });
  }

  // The editor's template picker rewrites the cover, so the design's template
  // can change after creation — otherwise the row would keep pointing at
  // whichever template the editor happened to open with.
  if (templateId !== undefined) {
    // …but only to another of its own product's, which share its trim.
    if (
      typeof templateId !== "string" ||
      (await templateProductSlug(templateId)) !== existing.productId
    ) {
      return Response.json({ error: "Unknown templateId" }, { status: 400 });
    }
  }

  // Page count and paper are written only when sent — a rename from /account
  // must not write back whatever they were when that page loaded.
  const specGiven = pagesOptionId !== undefined || paperId !== undefined;
  const spec = {
    pagesOptionId: String(pagesOptionId ?? existing.pagesOptionId),
    paperId: String(paperId ?? existing.paperId),
  };

  // A doc is optional (a rename alone is valid), but if present it must be
  // consistent with the spec it is being saved alongside.
  let nextDoc = undefined;
  if (doc !== undefined || specGiven) {
    const pageOption = await getPageCountOption(existing.productId, spec.pagesOptionId);
    if (!pageOption) {
      return Response.json({ error: "Unknown page count option" }, { status: 400 });
    }
    if (doc === undefined) {
      // A new page count with no doc would break the doc's page-count invariant.
      return Response.json({ error: "doc is required with a page count or paper" }, { status: 400 });
    }
    const format = (await getProductFormats()).get(existing.productId) ?? BOOKLET_FORMAT;
    const validated = validateDesignPayload(doc, pageOption.pageCount, format.trim);
    if (!validated.ok) return Response.json({ error: validated.error }, { status: 400 });
    nextDoc = validated.doc;
  }

  let updated;
  try {
    updated = await write(
      {
        doc: nextDoc,
        spec: specGiven ? spec : undefined,
        name: typeof name === "string" ? name.trim().slice(0, 200) || "Untitled design" : undefined,
        templateId: typeof templateId === "string" ? templateId : undefined,
      },
      expectedRevision,
    );
  } catch (error) {
    if (error instanceof DesignConflictError) {
      return Response.json(
        { error: error.message, reason: DESIGN_CONFLICT_REASON },
        { status: 409 },
      );
    }
    // Resolver misses (e.g. an unknown paper slug for this product) are
    // client errors.
    if (error instanceof Error && error.message.startsWith("Unknown")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!updated) return Response.json({ error: "Design not found" }, { status: 404 });

  return Response.json({
    id: updated.id,
    name: updated.name,
    revision: updated.revision,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
