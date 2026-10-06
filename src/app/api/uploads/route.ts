import type { NextRequest } from "next/server";

import { clientKey, createRateLimiter } from "@/lib/rateLimit";
import { getOrCreateOwner } from "@/lib/session";
import { createCanvaUpload, createPdfUpload, uploadErrorResponse } from "@/lib/uploads.server";

export const runtime = "nodejs";

/** Uploads started per IP — each one is a row and a presigned URL. */
const starts = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 });

/**
 * POST /api/uploads — start the "Upload your own design" flow's step 2.
 *
 * `{ source: "pdf", fileName, byteSize, contentType }` reserves an upload and
 * answers with a presigned PUT; the browser sends the PDF straight to object
 * storage with it, so the bytes never pass through this function (Vercel's
 * 4.5MB request-body cap). `{ source: "canva", canvaUrl }` records a link for
 * staff to download instead.
 */
export async function POST(request: NextRequest) {
  if (!starts.hit(clientKey(request.headers))) {
    return Response.json({ error: "Too many uploads — please wait a few minutes and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { source, fileName, byteSize, contentType, canvaUrl } = (body ?? {}) as Record<string, unknown>;
  if (source !== "pdf" && source !== "canva") {
    return Response.json({ error: "source must be \"pdf\" or \"canva\"" }, { status: 400 });
  }

  const owner = await getOrCreateOwner();
  try {
    const created =
      source === "pdf"
        ? await createPdfUpload(owner, { fileName, byteSize, contentType })
        : await createCanvaUpload(owner, canvaUrl);
    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = uploadErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
