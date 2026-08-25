/**
 * Object storage for customer-uploaded photographs.
 *
 * Written against the plain S3 API so it works with AWS S3, Cloudflare R2 and
 * MinIO alike — set S3_ENDPOINT for the non-AWS ones.
 *
 * Photos are uploaded **directly from the browser** using a presigned PUT.
 * That is deliberate: Vercel caps a serverless function's request body at
 * 4.5MB, and print-resolution photographs routinely exceed it, so the bytes
 * must never pass through a Route Handler.
 */
import { PutObjectCommand, S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Uploads larger than this are rejected before a presigned URL is issued. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export function isAllowedImageType(value: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

export function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    default:
      return "jpg";
  }
}

export interface StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Set for R2/MinIO; leave unset for AWS S3. */
  endpoint?: string;
  /** CDN or public bucket origin used to build read URLs. */
  publicBaseUrl?: string;
}

export function readStorageConfig(): StorageConfig | null {
  const { S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    bucket: S3_BUCKET,
    region: S3_REGION,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  };
}

export function isStorageConfigured(): boolean {
  return readStorageConfig() !== null;
}

function requireConfig(): StorageConfig {
  const config = readStorageConfig();
  if (!config) {
    throw new Error(
      "Object storage is not configured — set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (see .env.example).",
    );
  }
  return config;
}

let client: S3Client | undefined;

function getClient(config: StorageConfig): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      // R2/MinIO need path-style addressing; AWS S3 is happy with it too.
      forcePathStyle: Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

/** Public read URL for a stored object. */
export function publicUrlFor(storageKey: string): string {
  const config = requireConfig();
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/${storageKey}`;
  }
  if (config.endpoint) {
    return `${config.endpoint.replace(/\/$/, "")}/${config.bucket}/${storageKey}`;
  }
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${storageKey}`;
}

/**
 * Presigned PUT the browser uploads straight to. `contentType` is bound into
 * the signature, so the client cannot upload a different type than it declared.
 */
export async function createUploadUrl(
  storageKey: string,
  contentType: string,
  expiresInSeconds = 600,
): Promise<string> {
  const config = requireConfig();
  return getSignedUrl(
    getClient(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteObject(storageKey: string): Promise<void> {
  const config = requireConfig();
  await getClient(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }),
  );
}
