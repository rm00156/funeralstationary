import type { NextConfig } from "next";
import { chromiumTracingIncludes } from "./src/lib/chromiumRoutes";

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
  // Lets the dev server (and its client JS/HMR) be requested through an
  // ngrok or cloudflared quick tunnel — Next otherwise blocks cross-origin dev
  // asset requests, which silently breaks hydration (buttons render but clicks
  // do nothing).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app", "*.trycloudflare.com"],
  // The one-off /order-of-service page became the generic product page.
  async redirects() {
    return [
      { source: "/order-of-service", destination: "/products/order-of-service", permanent: true },
      // My Designs and My Orders became sections of the one account page.
      { source: "/designs", destination: "/account", permanent: true },
      { source: "/orders", destination: "/account", permanent: true },
    ];
  },
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
  // Keys are route globs. The dev-only puppeteer package (with its bundled
  // Chromium) must stay out of every deployed function that launches a
  // browser — /api/proof, the admin template publish + order proof routes,
  // and the Stripe webhook / checkout return routes that render proofs.
  outputFileTracingExcludes: {
    "/**": ["./node_modules/puppeteer/**"],
  },
  // …and @sparticuz/chromium's browser binary must be added to them by hand:
  // the tracer can't see it (see chromiumRoutes.ts).
  outputFileTracingIncludes: chromiumTracingIncludes(),
};

export default nextConfig;
