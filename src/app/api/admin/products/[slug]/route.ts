import type { NextRequest } from "next/server";
import { adminUpdateProduct } from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import {
  parseBoolean,
  parseLabel,
  parseProductDescription,
  parseProductOccasion,
  parseShortLabel,
  parseSortOrder,
  parseTemplatePages,
  parseTrimMm,
  parseVatTreatment,
} from "@/lib/adminValidation";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/products/:slug — edit label / blurb / occasion / VAT
 * treatment / sort / active, and the format (size label, trim, template pages, sized-by-option,
 * paper label). Not slug. The trim and template pages 409 once the product
 * has a template, since its layout is drawn on them.
 */
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
  const {
    label,
    description,
    occasion,
    vatTreatment,
    sortOrder,
    isActive,
    sizeLabel,
    trimWidthMm,
    trimHeightMm,
    templatePages,
    sizedByOption,
    paperLabel,
  } = (body ?? {}) as Record<string, unknown>;

  const patch: Parameters<typeof adminUpdateProduct>[1] = {};
  if (label !== undefined) {
    const parsed = parseLabel(label);
    if (!parsed) return Response.json({ error: "Invalid label" }, { status: 400 });
    patch.label = parsed;
  }
  if (description !== undefined) {
    const parsed = parseProductDescription(description);
    if (parsed === undefined) {
      return Response.json(
        { error: "description must be text of at most 300 characters" },
        { status: 400 },
      );
    }
    patch.description = parsed;
  }
  if (occasion !== undefined) {
    const parsed = parseProductOccasion(occasion);
    if (!parsed) return Response.json({ error: "Invalid occasion" }, { status: 400 });
    patch.occasion = parsed;
  }
  if (vatTreatment !== undefined) {
    const parsed = parseVatTreatment(vatTreatment);
    if (!parsed) return Response.json({ error: "Invalid VAT treatment" }, { status: 400 });
    patch.vatTreatment = parsed;
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

  if (sizeLabel !== undefined) {
    const parsed = parseShortLabel(sizeLabel, 64);
    if (!parsed) return Response.json({ error: "Invalid size label" }, { status: 400 });
    patch.sizeLabel = parsed;
  }
  if (paperLabel !== undefined) {
    const parsed = parseShortLabel(paperLabel, 40);
    if (!parsed) return Response.json({ error: "Invalid paper label" }, { status: 400 });
    patch.paperLabel = parsed;
  }
  for (const [key, value] of [
    ["trimWidthMm", trimWidthMm],
    ["trimHeightMm", trimHeightMm],
  ] as const) {
    if (value === undefined) continue;
    const parsed = parseTrimMm(value);
    if (parsed === null) {
      return Response.json(
        { error: "Trim sizes must be whole millimetres from 20 to 1500" },
        { status: 400 },
      );
    }
    patch[key] = parsed;
  }
  if (templatePages !== undefined) {
    const parsed = parseTemplatePages(templatePages);
    if (parsed === null) {
      return Response.json({ error: "templatePages must be 1, 2 or 3" }, { status: 400 });
    }
    patch.templatePages = parsed;
  }
  if (sizedByOption !== undefined) {
    const parsed = parseBoolean(sizedByOption);
    if (parsed === null) return Response.json({ error: "Invalid sizedByOption" }, { status: 400 });
    patch.sizedByOption = parsed;
  }

  const updated = await adminUpdateProduct(slug, patch);
  if (!updated) return Response.json({ error: "Product not found" }, { status: 404 });
  if ("locked" in updated) {
    return Response.json(
      {
        error:
          "The trim and page structure can't change once the product has templates — their layouts are drawn on them. Create a new product for a new format.",
      },
      { status: 409 },
    );
  }
  return Response.json({ product: updated });
}
