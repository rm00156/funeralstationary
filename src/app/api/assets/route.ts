import type { NextRequest } from "next/server";
import { db } from "@/db";
import { designAssets } from "@/db/schema";
import { getOrCreateOwner } from "@/lib/session";
import {
  MAX_UPLOAD_BYTES,
  createUploadUrl,
  extensionFor,
  isAllowedImageType,
  isStorageConfigured,
  publicUrlFor,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * POST /api/assets — reserve an asset and hand back a presigned PUT URL.
 *
 * The browser uploads the bytes straight to object storage with that URL;
 * they never pass through this function, which is what keeps uploads clear
 * of Vercel's 4.5MB serverless request-body cap.
 */
export async function POST(request: NextRequest) {
  if (!isStorageConfigured()) {
    return Response.json(
      { error: "Photo uploads are not configured on this environment." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { contentType, byteSize, designId } = (body ?? {}) as Record<string, unknown>;

  if (typeof contentType !== "string" || !isAllowedImageType(contentType)) {
    return Response.json(
      { error: "Unsupported image type — use JPEG, PNG, WebP or HEIC." },
      { status: 400 },
    );
  }
  const size = Number(byteSize);
  if (!Number.isFinite(size) || size <= 0) {
    return Response.json({ error: "byteSize is required" }, { status: 400 });
  }
  if (size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `Photos must be ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB or smaller.` },
      { status: 413 },
    );
  }

  const owner = await getOrCreateOwner();
  const id = crypto.randomUUID();
  const storageKey = `designs/${owner.guestToken}/${id}.${extensionFor(contentType)}`;

  const [uploadUrl, url] = [await createUploadUrl(storageKey, contentType), publicUrlFor(storageKey)];

  await db.insert(designAssets).values({
    id,
    userId: owner.userId,
    guestToken: owner.userId ? null : owner.guestToken,
    designId: typeof designId === "string" && designId ? designId : null,
    storageKey,
    url,
    mimeType: contentType,
    byteSize: Math.round(size),
  });

  return Response.json({ id, uploadUrl, url }, { status: 201 });
}
