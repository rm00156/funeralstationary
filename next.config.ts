import type { NextConfig } from "next";

/**
 * next/image hard-errors on hosts it doesn't know, so the object-storage
 * host (admin-uploaded template previews, design photos) must be allowed
 * alongside the seeded Stitch-export images. Derived from the same S3_* env
 * vars src/lib/storage.ts builds public URLs from.
 */
function storageHost(): string | null {
  const explicit = process.env.S3_PUBLIC_BASE_URL ?? process.env.S3_ENDPOINT;
  if (explicit) {
    try {
      return new URL(explicit).hostname;
    } catch {
      return null;
    }
  }
  const { S3_BUCKET, S3_REGION } = process.env;
  if (S3_BUCKET && S3_REGION) return `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
  return null;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      ...(storageHost()
        ? [{ protocol: "https" as const, hostname: storageHost()! }]
        : []),
    ],
  },
  // `puppeteer` (full, with a bundled Chromium download) is dev-only — the
  // deployed /api/proof function uses puppeteer-core + @sparticuz/chromium
  // instead. Keep it out of the traced serverless bundle.
  outputFileTracingExcludes: {
    "/api/proof": ["./node_modules/puppeteer/**"],
  },
};

export default nextConfig;
