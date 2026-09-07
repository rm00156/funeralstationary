import type { NextRequest } from "next/server";
import {
  adminDeleteTemplate,
  adminGetTemplate,
  adminUpdateTemplate,
} from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import {
  parseCategorySlugs,
  parseImageUrl,
  parseLabel,
  parseSlug,
  parseSortOrder,
  parseTemplateStatus,
} from "@/lib/adminValidation";

export const runtime = "nodejs";

/** GET /api/admin/templates/:slug — one template, any status, with layout. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;
  const template = await adminGetTemplate(slug);
  if (!template) return Response.json({ error: "Template not found" }, { status: 404 });
  return Response.json({ template });
}

/** PATCH /api/admin/templates/:slug — edit metadata and category links. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { name, productId, previewImageUrl, status, sortOrder, categories } =
    (body ?? {}) as Record<string, unknown>;

  const patch: Parameters<typeof adminUpdateTemplate>[1] = {};
  if (name !== undefined) {
    const parsed = parseLabel(name);
    if (!parsed) return Response.json({ error: "Invalid name" }, { status: 400 });
    patch.name = parsed;
  }
  if (productId !== undefined) {
    const parsed = parseSlug(productId);
    if (!parsed) return Response.json({ error: "Invalid productId" }, { status: 400 });
    patch.productSlug = parsed;
  }
  if (previewImageUrl !== undefined) {
    const parsed = parseImageUrl(previewImageUrl);
    if (!parsed) {
      return Response.json({ error: "previewImageUrl must be a valid URL" }, { status: 400 });
    }
    patch.previewImageUrl = parsed;
  }
  if (status !== undefined) {
    const parsed = parseTemplateStatus(status);
    if (!parsed) return Response.json({ error: "Invalid status" }, { status: 400 });
    patch.status = parsed;
  }
  if (sortOrder !== undefined) {
    const parsed = parseSortOrder(sortOrder);
    if (parsed === null) return Response.json({ error: "Invalid sortOrder" }, { status: 400 });
    patch.sortOrder = parsed;
  }
  if (categories !== undefined) {
    const parsed = parseCategorySlugs(categories);
    if (!parsed) {
      return Response.json({ error: "categories must be a list of unique slugs" }, { status: 400 });
    }
    patch.categories = parsed;
  }

  try {
    const updated = await adminUpdateTemplate(slug, patch);
    if (!updated) return Response.json({ error: "Template not found" }, { status: 404 });
    return Response.json({ template: updated });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

/**
 * DELETE /api/admin/templates/:slug — remove a template that nothing has ever
 * used. The catalogue's rule is retire-don't-delete (see
 * adminCatalogue.server.ts); this exists only so an unused draft — typically a
 * templates:generate reject — doesn't have to be archived and lived with
 * forever. A template with designs behind it 409s and stays put.
 */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;
  const result = await adminDeleteTemplate(slug);
  if (result.status === "not-found") {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }
  if (result.status === "in-use") {
    return Response.json(
      {
        error: `This template can't be deleted — ${result.designCount} customer ${
          result.designCount === 1 ? "design uses" : "designs use"
        } it. Set its status to Archived instead.`,
      },
      { status: 409 },
    );
  }
  return Response.json({ ok: true });
}
