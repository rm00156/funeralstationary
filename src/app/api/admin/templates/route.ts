import type { NextRequest } from "next/server";
import {
  adminCreateTemplate,
  adminListTemplates,
  isDuplicateKeyError,
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

/** GET /api/admin/templates — every template, any status. */
export async function GET() {
  if (!(await isAdmin())) return unauthorised();
  return Response.json({ templates: await adminListTemplates() });
}

/** POST /api/admin/templates — create a template (layout starts null). */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return unauthorised();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { slug, name, productId, previewImageUrl, status, sortOrder, categories } =
    (body ?? {}) as Record<string, unknown>;

  const parsedSlug = parseSlug(slug);
  if (!parsedSlug) {
    return Response.json(
      { error: "slug must be 1-64 lowercase letters, digits and hyphens" },
      { status: 400 },
    );
  }
  const parsedName = parseLabel(name);
  if (!parsedName) return Response.json({ error: "name is required" }, { status: 400 });
  const parsedProduct = parseSlug(productId);
  if (!parsedProduct) return Response.json({ error: "productId is required" }, { status: 400 });
  const parsedImage = parseImageUrl(previewImageUrl);
  if (!parsedImage) {
    return Response.json({ error: "previewImageUrl must be a valid URL" }, { status: 400 });
  }
  const parsedStatus = status === undefined ? "draft" : parseTemplateStatus(status);
  if (!parsedStatus) return Response.json({ error: "Invalid status" }, { status: 400 });
  const parsedSort = sortOrder === undefined ? 0 : parseSortOrder(sortOrder);
  if (parsedSort === null) return Response.json({ error: "Invalid sortOrder" }, { status: 400 });
  const parsedCategories = categories === undefined ? [] : parseCategorySlugs(categories);
  if (!parsedCategories) {
    return Response.json({ error: "categories must be a list of unique slugs" }, { status: 400 });
  }

  try {
    const created = await adminCreateTemplate({
      slug: parsedSlug,
      name: parsedName,
      productSlug: parsedProduct,
      previewImageUrl: parsedImage,
      status: parsedStatus,
      sortOrder: parsedSort,
      categories: parsedCategories,
    });
    return Response.json({ template: created }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return Response.json(
        { error: `A template with the slug "${parsedSlug}" already exists` },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.startsWith("Unknown")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
