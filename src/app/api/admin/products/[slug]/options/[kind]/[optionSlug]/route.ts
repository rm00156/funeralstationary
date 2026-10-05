import type { NextRequest } from "next/server";
import { adminGetProduct, adminUpdateOption, isOptionKind } from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { pageCountFormatError, parseOptionPatch } from "@/lib/adminValidation";
import type { TemplatePageCount } from "@/lib/designEditor";

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

  if (parsed.value.pageCount !== undefined) {
    const product = await adminGetProduct(slug);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    const formatError = pageCountFormatError(
      parsed.value.pageCount,
      product.templatePages as TemplatePageCount,
    );
    if (formatError) return Response.json({ error: formatError }, { status: 400 });
  }

  const updated = await adminUpdateOption(slug, kind, optionSlug, parsed.value);
  if (!updated) return Response.json({ error: "Option not found" }, { status: 404 });
  return Response.json({ option: updated });
}
