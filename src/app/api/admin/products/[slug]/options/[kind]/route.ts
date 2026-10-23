import type { NextRequest } from "next/server";
import {
  adminCreateOption,
  adminGetProduct,
  adminListOptions,
  adminReorderOptions,
  isDuplicateKeyError,
  isOptionKind,
} from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminAuth.server";
import {
  pageCountFormatError,
  parseOptionInput,
  parseSlugOrder,
  sizeFormatError,
} from "@/lib/adminValidation";
import type { TemplatePageCount } from "@/lib/designEditor";

export const runtime = "nodejs";

/** GET /api/admin/products/:slug/options/:kind — every row, active or not. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[slug]/options/[kind]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug, kind } = await ctx.params;
  if (!isOptionKind(kind)) {
    return Response.json({ error: "Unknown option kind" }, { status: 404 });
  }
  const options = await adminListOptions(slug, kind);
  if (!options) return Response.json({ error: "Product not found" }, { status: 404 });
  return Response.json({ options });
}

/** POST /api/admin/products/:slug/options/:kind — add a pricing option. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[slug]/options/[kind]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug, kind } = await ctx.params;
  if (!isOptionKind(kind)) {
    return Response.json({ error: "Unknown option kind" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseOptionInput(kind, (body ?? {}) as Record<string, unknown>);
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
  if (parsed.value.widthMm !== undefined && parsed.value.heightMm !== undefined) {
    const product = await adminGetProduct(slug);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    const formatError = sizeFormatError(product, parsed.value.widthMm, parsed.value.heightMm);
    if (formatError) return Response.json({ error: formatError }, { status: 400 });
  }

  try {
    const created = await adminCreateOption(slug, kind, parsed.value);
    if (!created) return Response.json({ error: "Product not found" }, { status: 404 });
    return Response.json({ option: created }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return Response.json(
        { error: `An option with the slug "${parsed.value.slug}" already exists` },
        { status: 400 },
      );
    }
    throw error;
  }
}

/**
 * PUT /api/admin/products/:slug/options/:kind — `{ order: slug[] }`, every
 * option of the kind once, in the order customers should see them. 409 when
 * the list no longer matches (an option was added in another tab).
 */
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/products/[slug]/options/[kind]">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug, kind } = await ctx.params;
  if (!isOptionKind(kind)) {
    return Response.json({ error: "Unknown option kind" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const order = parseSlugOrder((body as Record<string, unknown> | null)?.order);
  if (!order) return Response.json({ error: "order must list each option slug once" }, { status: 400 });

  const result = await adminReorderOptions(slug, kind, order);
  if (result === null) return Response.json({ error: "Product not found" }, { status: 404 });
  if (!result) {
    return Response.json(
      { error: "These options have changed since you opened them — reload the page and try again" },
      { status: 409 },
    );
  }
  return Response.json({ ok: true });
}
