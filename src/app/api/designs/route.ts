import type { NextRequest } from "next/server";
import {
  createDesign,
  listDesigns,
  validateDesignPayload,
} from "@/lib/designs.server";
import { getOrCreateOwner } from "@/lib/session";
import { PRODUCTS, TEMPLATES } from "@/lib/templates";

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

  if (!TEMPLATES.some((template) => template.id === templateId)) {
    return Response.json({ error: "Unknown templateId" }, { status: 400 });
  }
  if (!PRODUCTS.some((product) => product.id === productId)) {
    return Response.json({ error: "Unknown productId" }, { status: 400 });
  }

  const spec = {
    pagesOptionId: String(pagesOptionId ?? "4"),
    paperId: String(paperId ?? "silk"),
  };
  const validated = validateDesignPayload(doc, spec);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const owner = await getOrCreateOwner();
  const created = await createDesign(owner, {
    templateId: templateId as string,
    productId: productId as string,
    name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : "Untitled design",
    doc: validated.doc,
    spec,
  });

  return Response.json(
    {
      id: created.id,
      name: created.name,
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
