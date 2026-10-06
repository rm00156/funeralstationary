/**
 * Server-side reads/writes for customer-made artwork (artwork_uploads) — the
 * "Upload your own design" flow's seam, scoped by Owner exactly as
 * designs.server.ts scopes designs: a stranger's upload reads as missing.
 *
 * The PDF itself never passes through here on the way in — the browser PUTs
 * it straight to object storage with a presigned URL, for the same 4.5MB
 * request-body reason as photos (see storage.ts). The server reads it back
 * once, from storage, to analyse it, and keeps the analysis on the row; every
 * later check against a different product or page count reuses it.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { artworkUploads } from "@/db/schema";
import {
  ARTWORK_CONTENT_TYPE,
  MAX_ARTWORK_BYTES,
  evaluateArtwork,
  parseCanvaUrl,
  type ArtworkAnalysis,
  type ArtworkReport,
  type ArtworkTarget,
} from "@/lib/artwork";
import { getSellableProduct } from "@/lib/catalogue.server";
import { analysePdf } from "@/lib/pdfAnalysis";
import { getPricingData } from "@/lib/pricing.server";
import { ownerKey, type Owner } from "@/lib/session";
import {
  createUploadUrl,
  isStorageConfigured,
  publicUrlFor,
  readObject,
} from "@/lib/storage";
import type { ProductShowcase } from "@/lib/templates";
import type { PricingData } from "@/lib/orderOfServicePricing";

/** A client-caused failure the route can map straight to a status code. */
export class UploadError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 413 | 503,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** Route helper: the Response for an UploadError, else null. */
export function uploadErrorResponse(error: unknown): Response | null {
  return error instanceof UploadError
    ? Response.json({ error: error.message }, { status: error.status })
    : null;
}

export interface ArtworkUpload {
  id: string;
  source: "pdf" | "canva";
  fileName: string | null;
  url: string | null;
  storageKey: string | null;
  byteSize: number | null;
  canvaUrl: string | null;
  analysis: ArtworkAnalysis | null;
}

function ownedBy(owner: Owner) {
  return owner.userId === null
    ? eq(artworkUploads.guestToken, owner.guestToken)
    : eq(artworkUploads.userId, owner.userId);
}

function ownerColumns(owner: Owner) {
  return { userId: owner.userId, guestToken: owner.userId ? null : owner.guestToken };
}

/** A file name fit to show back to the customer: no path, no control characters. */
function cleanFileName(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const base = raw.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return clean || "your-design.pdf";
}

/**
 * Reserve an upload and hand back the presigned PUT the browser sends the PDF
 * to. The row exists before the bytes do; the check reads them from storage
 * and says so if they never arrived.
 */
export async function createPdfUpload(
  owner: Owner,
  input: { fileName: unknown; byteSize: unknown; contentType: unknown },
): Promise<{ id: string; uploadUrl: string }> {
  if (!isStorageConfigured()) {
    throw new UploadError(503, "Uploading files isn’t available right now — please send us your Canva link, or call us.");
  }
  if (input.contentType !== ARTWORK_CONTENT_TYPE) {
    throw new UploadError(400, "Please upload a PDF file.");
  }
  const size = Number(input.byteSize);
  if (!Number.isFinite(size) || size <= 0) throw new UploadError(400, "byteSize is required");
  if (size > MAX_ARTWORK_BYTES) {
    throw new UploadError(
      413,
      `Your file is larger than ${Math.floor(MAX_ARTWORK_BYTES / (1024 * 1024))} MB — please call us and we’ll take it another way.`,
    );
  }

  const id = crypto.randomUUID();
  const storageKey = `uploads/${ownerKey(owner)}/${id}.pdf`;
  const uploadUrl = await createUploadUrl(storageKey, ARTWORK_CONTENT_TYPE);
  await db.insert(artworkUploads).values({
    id,
    ...ownerColumns(owner),
    source: "pdf",
    fileName: cleanFileName(input.fileName),
    storageKey,
    url: publicUrlFor(storageKey),
    byteSize: Math.round(size),
  });
  return { id, uploadUrl };
}

/** Record a Canva link. Staff download and check those by hand. */
export async function createCanvaUpload(owner: Owner, link: unknown): Promise<{ id: string }> {
  const canvaUrl = parseCanvaUrl(link);
  if (!canvaUrl) {
    throw new UploadError(400, "That doesn’t look like a Canva design link — it should start canva.com/design/");
  }
  const id = crypto.randomUUID();
  await db.insert(artworkUploads).values({ id, ...ownerColumns(owner), source: "canva", canvaUrl });
  return { id };
}

export async function getUpload(owner: Owner, id: string): Promise<ArtworkUpload | null> {
  const [row] = await db
    .select()
    .from(artworkUploads)
    .where(and(eq(artworkUploads.id, id), ownedBy(owner)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    fileName: row.fileName,
    url: row.url,
    storageKey: row.storageKey,
    byteSize: row.byteSize,
    canvaUrl: row.canvaUrl,
    analysis: row.analysis,
  };
}

/** S3/R2/MinIO's "no such key" — the browser's PUT never landed. */
function isMissingObject(error: unknown): boolean {
  const name = (error as { name?: string; Code?: string } | null)?.name;
  return name === "NoSuchKey" || name === "NotFound";
}

/**
 * The file's facts, read once: downloaded from storage, analysed, and stored
 * on the row. Every later check — a different product, a different page
 * count — evaluates the stored facts without touching the file again.
 */
export async function analyseUpload(upload: ArtworkUpload): Promise<ArtworkAnalysis> {
  if (upload.analysis) return upload.analysis;
  if (upload.source !== "pdf" || !upload.storageKey) {
    throw new Error("Only an uploaded PDF can be analysed");
  }

  let bytes: Uint8Array;
  try {
    bytes = await readObject(upload.storageKey, MAX_ARTWORK_BYTES);
  } catch (error) {
    if (isMissingObject(error)) {
      throw new UploadError(409, "We didn’t receive your file — please upload it again.");
    }
    if (error instanceof Error && error.name === "ObjectTooLarge") {
      throw new UploadError(413, "Your file is too large to check — please call us and we’ll take it another way.");
    }
    throw error;
  }

  const analysis = await analysePdf(bytes);
  await db
    .update(artworkUploads)
    .set({ analysis, analysedAt: new Date() })
    .where(eq(artworkUploads.id, upload.id));
  return analysis;
}

export interface ResolvedTarget {
  product: ProductShowcase;
  pricing: PricingData;
  target: ArtworkTarget;
}

/** The customer's step-1 choice, resolved against the live catalogue. */
export async function resolveArtworkTarget(productSlug: unknown, pagesSlug: unknown): Promise<ResolvedTarget> {
  const product = typeof productSlug === "string" ? await getSellableProduct(productSlug) : null;
  if (!product) throw new UploadError(400, `Unknown product "${String(productSlug)}"`);
  const pricing = await getPricingData(product.id);
  const pages = pricing.pages.find((option) => option.id === pagesSlug);
  if (!pages) throw new UploadError(400, `Unknown pages option "${String(pagesSlug)}"`);
  return {
    product,
    pricing,
    target: { format: product.format, pages, pageOptions: pricing.pages },
  };
}

/**
 * Check an upload against a product and page count. A Canva link has no file
 * to read yet, so it reports nothing — staff check it when they download it.
 */
export async function checkUpload(
  owner: Owner,
  id: string,
  choice: { product: unknown; pages: unknown },
): Promise<ArtworkReport> {
  const upload = await getUpload(owner, id);
  if (!upload) throw new UploadError(404, "Upload not found");
  const { target } = await resolveArtworkTarget(choice.product, choice.pages);
  if (upload.source === "canva") return { checks: [], blocking: false, warnings: false };
  return evaluateArtwork(await analyseUpload(upload), target);
}
