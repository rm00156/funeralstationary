import type { NextRequest } from "next/server";
import { productExists, templateExists } from "@/lib/catalogue.server";
import {
  createDesign,
  listDesigns,
  validateDesignPayload,
} from "@/lib/designs.server";
import { getPageCountOption } from "@/lib/pricing.server";
import { getOrCreateOwner } from "@/lib/session";

export const runtime = "nodejs";

/** GET /api/designs — the caller's saved designs, newest first. */
export async function GET() {
  const owner = await getOrCreateOwner();
  const saved = await listDesigns(owner);
  return Response.json({
    designs: saved.map((design) => ({
      id: design.id,
      name: design.name,
      templateId: design.templateId,
      productId: design.productId,
      pageCount: design.pageCount,
      updatedAt: design.updatedAt.toISOString(),
    })),
  });
}

/** POST /api/designs — create a design from the editor's current state. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    templateId,
    productId,
    name,
    doc,
    pagesOptionId,
    paperId,
  } = (body ?? {}) as Record<string, unknown>;

  if (typeof templateId !== "string" || !(await templateExists(templateId))) {
    return Response.json({ error: "Unknown templateId" }, { status: 400 });
  }
  if (typeof productId !== "string" || !(await productExists(productId))) {
    return Response.json({ error: "Unknown productId" }, { status: 400 });
  }

  const spec = {
    pagesOptionId: String(pagesOptionId ?? ""),
    paperId: String(paperId ?? ""),
  };
  const pageOption = await getPageCountOption(productId, spec.pagesOptionId);
  if (!pageOption) {
    return Response.json({ error: "Unknown page count option" }, { status: 400 });
  }
  const validated = validateDesignPayload(doc, pageOption.pageCount);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const owner = await getOrCreateOwner();
  let created;
  try {
    created = await createDesign(owner, {
      templateId,
      productId,
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : "Untitled design",
      doc: validated.doc,
      spec,
    });
  } catch (error) {
    // The resolvers throw `Unknown … "slug"` for a spec slug that has no row
    // for this product (e.g. an unknown paper option) — a client error, not
    // a server fault.
    if (error instanceof Error && error.message.startsWith("Unknown")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return Response.json(
    {
      id: created.id,
      name: created.name,
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
