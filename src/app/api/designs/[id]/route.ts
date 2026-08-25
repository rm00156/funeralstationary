import type { NextRequest } from "next/server";
import { templateExists } from "@/lib/catalogue.server";
import {
  deleteDesign,
  getDesign,
  updateDesign,
  validateDesignPayload,
} from "@/lib/designs.server";
import { getPageCountOption } from "@/lib/pricing.server";
import { getOrCreateOwner } from "@/lib/session";

export const runtime = "nodejs";

/** GET /api/designs/:id — load one of the caller's designs. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/designs/[id]">) {
  const { id } = await ctx.params;
  const owner = await getOrCreateOwner();
  const design = await getDesign(owner, id);
  if (!design) return Response.json({ error: "Design not found" }, { status: 404 });

  return Response.json({
    id: design.id,
    name: design.name,
    templateId: design.templateId,
    productId: design.productId,
    doc: design.doc,
    pagesOptionId: design.pagesOptionId,
    paperId: design.paperId,
    updatedAt: design.updatedAt.toISOString(),
  });
}

/** PATCH /api/designs/:id — autosave/manual save of doc, spec and name. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/designs/[id]">) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { doc, pagesOptionId, paperId, name, templateId } = (body ?? {}) as Record<string, unknown>;

  const owner = await getOrCreateOwner();
  const existing = await getDesign(owner, id);
  if (!existing) return Response.json({ error: "Design not found" }, { status: 404 });

  // The editor's template picker rewrites the cover, so the design's template
  // can change after creation — otherwise the row would keep pointing at
  // whichever template the editor happened to open with.
  if (templateId !== undefined) {
    if (typeof templateId !== "string" || !(await templateExists(templateId))) {
      return Response.json({ error: "Unknown templateId" }, { status: 400 });
    }
  }

  const spec = {
    pagesOptionId: String(pagesOptionId ?? existing.pagesOptionId),
    paperId: String(paperId ?? existing.paperId),
  };
  const pageOption = await getPageCountOption(existing.productId, spec.pagesOptionId);
  if (!pageOption) {
    return Response.json({ error: "Unknown page count option" }, { status: 400 });
  }

  // A doc is optional (a rename alone is valid), but if present it must be
  // consistent with the spec it is being saved alongside.
  let nextDoc = undefined;
  if (doc !== undefined) {
    const validated = validateDesignPayload(doc, pageOption.pageCount);
    if (!validated.ok) return Response.json({ error: validated.error }, { status: 400 });
    nextDoc = validated.doc;
  }

  let updated;
  try {
    updated = await updateDesign(owner, id, {
      doc: nextDoc,
      spec,
      name: typeof name === "string" ? name.trim().slice(0, 200) || "Untitled design" : undefined,
      templateId: typeof templateId === "string" ? templateId : undefined,
    });
  } catch (error) {
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
    updatedAt: updated.updatedAt.toISOString(),
  });
}

/** DELETE /api/designs/:id — soft delete. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/designs/[id]">) {
  const { id } = await ctx.params;
  const owner = await getOrCreateOwner();
  const removed = await deleteDesign(owner, id);
  if (!removed) return Response.json({ error: "Design not found" }, { status: 404 });
  return Response.json({ ok: true });
}
