import type { NextRequest } from "next/server";
import {
  adminGetTemplate,
  adminSetTemplateLayout,
} from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseLayoutPages } from "@/lib/adminValidation";

export const runtime = "nodejs";

/** GET /api/admin/templates/:slug/layout — the authored layout, if any. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]/layout">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;
  const template = await adminGetTemplate(slug);
  if (!template) return Response.json({ error: "Template not found" }, { status: 404 });
  return Response.json({ layout: template.layout });
}

/**
 * PUT /api/admin/templates/:slug/layout — save the authored layout.
 * `{ pages: null }` clears it, reverting the template to makeStarterDoc().
 */
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]/layout">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { pages } = (body ?? {}) as Record<string, unknown>;

  const parsed = parseLayoutPages(pages ?? null);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const saved = await adminSetTemplateLayout(slug, parsed.pages);
  if (!saved) return Response.json({ error: "Template not found" }, { status: 404 });
  return Response.json({ ok: true });
}
