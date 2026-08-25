import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
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
