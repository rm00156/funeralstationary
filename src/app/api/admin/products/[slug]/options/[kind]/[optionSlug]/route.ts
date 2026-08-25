import type { NextRequest } from "next/server";
import { adminUpdateOption, isOptionKind } from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseOptionPatch } from "@/lib/adminValidation";

export const runtime = "nodejs";

/** PATCH /api/admin/products/:slug/options/:kind/:optionSlug — edit one row. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[slug]/options/[kind]/[optionSlug]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug, kind, optionSlug } = await ctx.params;
  if (!isOptionKind(kind)) {
    return Response.json({ error: "Unknown option kind" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseOptionPatch(kind, (body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const updated = await adminUpdateOption(slug, kind, optionSlug, parsed.value);
  if (!updated) return Response.json({ error: "Option not found" }, { status: 404 });
  return Response.json({ option: updated });
}
