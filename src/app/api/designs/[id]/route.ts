import type { NextRequest } from "next/server";
import { saveDesignPatch } from "@/lib/designPatch.server";
import { deleteDesign, getDesign, updateDesign } from "@/lib/designs.server";
import { getOrCreateOwner } from "@/lib/session";
import { isShopOpen, shopClosedResponse } from "@/lib/siteBilling.server";

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
    revision: design.revision,
    updatedAt: design.updatedAt.toISOString(),
  });
}

/** PATCH /api/designs/:id — autosave/manual save of doc, spec and name. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/designs/[id]">) {
  if (!(await isShopOpen())) return shopClosedResponse();
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = await getOrCreateOwner();
  const existing = await getDesign(owner, id);
  if (!existing) return Response.json({ error: "Design not found" }, { status: 404 });

  return saveDesignPatch(body, existing, (patch, expectedRevision) =>
    updateDesign(owner, id, patch, expectedRevision),
  );
}

/** DELETE /api/designs/:id — soft delete. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/designs/[id]">) {
  const { id } = await ctx.params;
  const owner = await getOrCreateOwner();
  const removed = await deleteDesign(owner, id);
  if (!removed) return Response.json({ error: "Design not found" }, { status: 404 });
  return Response.json({ ok: true });
}
