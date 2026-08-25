import type { NextRequest } from "next/server";
import { getTemplateBySlug } from "@/lib/catalogue.server";

export const runtime = "nodejs";

/**
 * GET /api/templates/:slug/layout — a published template's authored layout
 * (null when none has been authored yet). Used by the editor's template
 * picker on apply; published-only, so draft layouts never leak.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/templates/[slug]/layout">,
) {
  const { slug } = await ctx.params;
  const template = await getTemplateBySlug(slug);
  if (!template) return Response.json({ error: "Template not found" }, { status: 404 });
  return Response.json({ layout: template.layout });
}
