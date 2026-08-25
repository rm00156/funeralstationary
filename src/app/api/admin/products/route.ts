import type { NextRequest } from "next/server";
import {
  adminCreateProduct,
  adminListProducts,
  isDuplicateKeyError,
} from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseLabel, parseSlug, parseSortOrder } from "@/lib/adminValidation";

export const runtime = "nodejs";

/** GET /api/admin/products — every product, active or not. */
export async function GET() {
  if (!(await isAdmin())) return unauthorised();
  return Response.json({ products: await adminListProducts() });
}

/** POST /api/admin/products — create a product. Slug is immutable afterwards. */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return unauthorised();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { slug, label, sortOrder } = (body ?? {}) as Record<string, unknown>;

  const parsedSlug = parseSlug(slug);
  if (!parsedSlug) {
    return Response.json(
      { error: "slug must be 1-64 lowercase letters, digits and hyphens" },
      { status: 400 },
    );
  }
  const parsedLabel = parseLabel(label);
  if (!parsedLabel) return Response.json({ error: "label is required" }, { status: 400 });
  const parsedSort = sortOrder === undefined ? 0 : parseSortOrder(sortOrder);
  if (parsedSort === null) return Response.json({ error: "Invalid sortOrder" }, { status: 400 });

  try {
    const created = await adminCreateProduct({
      slug: parsedSlug,
      label: parsedLabel,
      sortOrder: parsedSort,
    });
    return Response.json({ product: created }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return Response.json(
        { error: `A product with the slug "${parsedSlug}" already exists` },
        { status: 400 },
      );
    }
    throw error;
  }
}
