import type { NextRequest } from "next/server";
import {
  adminClearTemplateLayout,
  adminDiscardTemplateDraftLayout,
  adminGetTemplate,
  adminPublishTemplateLayout,
  adminSaveTemplateDraftLayout,
  adminUpdateTemplate,
} from "@/lib/adminCatalogue.server";
import { isAdmin, unauthorised } from "@/lib/adminSession";
import { parseLayoutAction, parseLayoutPages } from "@/lib/adminValidation";
import { isStorageConfigured, uploadObject } from "@/lib/storage";
import { renderTemplateThumbnail } from "@/lib/templateThumbnail.server";

export const runtime = "nodejs";
// Publishing screenshots the new cover via headless Chromium (see
// /api/proof's maxDuration comment) — needs Vercel Pro or higher in
// production, same requirement /api/proof already carries.
export const maxDuration = 30;

const notFound = () => Response.json({ error: "Template not found" }, { status: 404 });

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/templates/:slug/layout — the live layout and the draft.
 * `draftLayout: null` means there are no unpublished changes.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]/layout">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;
  const template = await adminGetTemplate(slug);
  if (!template) return notFound();
  return Response.json({
    layout: template.layout,
    draftLayout: template.draftLayout,
    hasDraftLayout: template.hasDraftLayout,
  });
}

/**
 * PUT /api/admin/templates/:slug/layout — save the authoring editor's
 * work-in-progress pages. This is where the editor's autosave lands, so it
 * writes `draft_layout` only: customers keep seeing the published layout
 * until POST { action: "publish" }.
 */
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]/layout">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;

  const body = await readJson(request);
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  const parsed = parseLayoutPages(body.pages ?? null);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  if (!parsed.pages) {
    return Response.json(
      { error: 'Use POST { action: "discard" | "clear" } to remove a layout' },
      { status: 400 },
    );
  }

  const saved = await adminSaveTemplateDraftLayout(slug, parsed.pages);
  if (!saved) return notFound();
  return Response.json({ ok: true });
}

/**
 * POST /api/admin/templates/:slug/layout — the three non-save operations:
 * publish the draft to customers, throw the draft away, or clear the
 * authored layout entirely (reverting to makeStarterDoc()).
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/templates/[slug]/layout">,
) {
  if (!(await isAdmin())) return unauthorised();
  const { slug } = await ctx.params;

  const body = await readJson(request);
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  const action = parseLayoutAction(body.action);
  if (!action) {
    return Response.json(
      { error: 'action must be "publish", "discard" or "clear"' },
      { status: 400 },
    );
  }

  if (action === "publish") {
    const result = await adminPublishTemplateLayout(slug);
    if (result.status === "not-found") return notFound();
    if (result.status === "nothing") {
      return Response.json({ error: "No unpublished changes" }, { status: 409 });
    }

    // Best-effort: a preview-thumbnail hiccup should never fail the publish
    // itself, since the layout is already live at this point.
    const coverPage = result.pages[0];
    if (isStorageConfigured() && coverPage) {
      try {
        const origin = new URL(request.url).origin;
        const png = await renderTemplateThumbnail(origin, coverPage);
        const url = await uploadObject(
          `template-previews/${slug}-${Date.now()}.png`,
          png,
          "image/png",
        );
        await adminUpdateTemplate(slug, { previewImageUrl: url });
      } catch (error) {
        console.error(`Could not regenerate the preview thumbnail for "${slug}"`, error);
      }
    }

    return Response.json({ ok: true });
  }

  const done =
    action === "discard"
      ? await adminDiscardTemplateDraftLayout(slug)
      : await adminClearTemplateLayout(slug);
  if (!done) return notFound();
  return Response.json({ ok: true });
}
