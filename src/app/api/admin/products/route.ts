import type { NextRequest } from "next/server";
import {
  adminCreateProduct,
  adminListProducts,
  adminReorderProducts,
  isDuplicateKeyError,
} from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import {
  parseBoolean,
  parseLabel,
  parseProductOccasion,
  parseSlugOrder,
  parseSlug,
  parseSortOrder,
  parseVatTreatment,
} from "@/lib/adminValidation";

export const runtime = "nodejs";

/** GET /api/admin/products — every product, active or not. */
export async function GET() {
  if (!(await isAdmin())) return unauthorised();
  return Response.json({ products: await adminListProducts() });
}

/**
 * POST /api/admin/products — create a product. Slug is immutable afterwards.
 * Without a sortOrder it goes to the end of the range.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return unauthorised();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { slug, label, occasion, vatTreatment, isActive, sortOrder } = (body ?? {}) as Record<
    string,
    unknown
  >;

  const parsedSlug = parseSlug(slug);
  if (!parsedSlug) {
    return Response.json(
      { error: "slug must be 1-64 lowercase letters, digits and hyphens" },
      { status: 400 },
    );
  }
  const parsedLabel = parseLabel(label);
  if (!parsedLabel) return Response.json({ error: "label is required" }, { status: 400 });
  const parsedOccasion = occasion === undefined ? undefined : parseProductOccasion(occasion);
  if (parsedOccasion === null) return Response.json({ error: "Invalid occasion" }, { status: 400 });
  const parsedVat = vatTreatment === undefined ? undefined : parseVatTreatment(vatTreatment);
  if (parsedVat === null) return Response.json({ error: "Invalid VAT treatment" }, { status: 400 });
  const parsedActive = isActive === undefined ? undefined : parseBoolean(isActive);
  if (parsedActive === null) return Response.json({ error: "Invalid isActive" }, { status: 400 });
  const parsedSort = sortOrder === undefined ? undefined : parseSortOrder(sortOrder);
  if (parsedSort === null) return Response.json({ error: "Invalid sortOrder" }, { status: 400 });

  try {
    const created = await adminCreateProduct({
      slug: parsedSlug,
      label: parsedLabel,
      occasion: parsedOccasion,
      vatTreatment: parsedVat,
      isActive: parsedActive,
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

/**
 * PUT /api/admin/products — `{ order: slug[] }`, every product once, in the
 * order customers should see them. 409 when the list no longer matches the
 * range (a product was added in another tab).
 */
export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return unauthorised();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const order = parseSlugOrder((body as Record<string, unknown> | null)?.order);
  if (!order) return Response.json({ error: "order must list each product slug once" }, { status: 400 });

  if (!(await adminReorderProducts(order))) {
    return Response.json(
      { error: "The product list has changed since you opened it — reload the page and try again" },
      { status: 409 },
    );
  }
  return Response.json({ ok: true });
}
