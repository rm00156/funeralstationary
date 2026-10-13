import type { NextRequest } from "next/server";

import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import { saveDesignPatch } from "@/lib/designPatch.server";
import { adminFindDesign, adminWriteDesign } from "@/lib/designs.server";

export const runtime = "nodejs";

/** GET /api/admin/designs/:id — the latest copy, for the admin editor to check it isn't stale. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/designs/[id]">) {
  if (!(await isAdmin())) return unauthorised();
  const { id } = await ctx.params;
  const design = await adminFindDesign(id);
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

/**
 * PATCH /api/admin/designs/:id — an admin's save to a customer's design, made
 * on their behalf from /admin/designs/:id. The same checks as the customer's
 * own save; not gated on the site subscription, since helping a customer with
 * work they've already started is admin work.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/designs/[id]">) {
  if (!(await isAdmin())) return unauthorised();
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = await adminFindDesign(id);
  if (!existing) return Response.json({ error: "Design not found" }, { status: 404 });

  return saveDesignPatch(body, existing, (patch, expectedRevision) =>
    adminWriteDesign(id, patch, expectedRevision),
  );
}
