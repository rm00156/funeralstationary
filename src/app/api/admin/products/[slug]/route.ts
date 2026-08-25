import type { NextRequest } from "next/server";
import { adminUpdateProduct } from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseBoolean, parseLabel, parseSortOrder } from "@/lib/adminValidation";

export const runtime = "nodejs";

/** PATCH /api/admin/products/:slug — edit label / sort / active. Not slug. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[slug]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { label, sortOrder, isActive } = (body ?? {}) as Record<string, unknown>;

  const patch: { label?: string; sortOrder?: number; isActive?: boolean } = {};
  if (label !== undefined) {
    const parsed = parseLabel(label);
    if (!parsed) return Response.json({ error: "Invalid label" }, { status: 400 });
    patch.label = parsed;
  }
  if (sortOrder !== undefined) {
    const parsed = parseSortOrder(sortOrder);
    if (parsed === null) return Response.json({ error: "Invalid sortOrder" }, { status: 400 });
    patch.sortOrder = parsed;
  }
  if (isActive !== undefined) {
    const parsed = parseBoolean(isActive);
    if (parsed === null) return Response.json({ error: "Invalid isActive" }, { status: 400 });
    patch.isActive = parsed;
  }

  const updated = await adminUpdateProduct(slug, patch);
  if (!updated) return Response.json({ error: "Product not found" }, { status: 404 });
  return Response.json({ product: updated });
}
