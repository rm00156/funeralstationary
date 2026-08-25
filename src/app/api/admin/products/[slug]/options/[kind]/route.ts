import type { NextRequest } from "next/server";
import {
  adminCreateOption,
  adminListOptions,
  isDuplicateKeyError,
  isOptionKind,
} from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseOptionInput } from "@/lib/adminValidation";

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
