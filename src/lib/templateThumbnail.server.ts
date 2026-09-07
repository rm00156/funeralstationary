/**
 * Auto-generates a template's preview thumbnail from the first page of its
 * layout, at publish time — see adminPublishTemplateLayout's caller in
 * /api/admin/templates/[slug]/layout. Reuses the exact same /proof-render
 * target as /api/proof (the real PageCanvas, not a second renderer), just
 * screenshotting one page at screen resolution instead of a full print-DPI
 * booklet.
 *
 * Empty photo windows are filled with a stand-in portrait for the shot only
 * (see placeholderPortraits) — a preview of a dashed empty box tells a
 * browsing customer nothing, but the stored layout must keep its nulls.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { launchHeadlessBrowser } from "@/lib/headlessBrowser.server";
import { isStorageConfigured, uploadObject } from "@/lib/storage";
import { placeholderPortraitUrl } from "@/lib/backgroundAssets.server";
import {
  portraitRotationForSeed,
  withPlaceholderPhotos,
} from "@/lib/placeholderPortraits";
import type { DesignDoc, DesignPage } from "@/lib/designEditor";

export async function renderTemplateThumbnail(
  origin: string,
  coverPage: DesignPage,
  /** Template slug, so each template keeps the same stand-in across republishes. */
  seed = "template",
): Promise<Buffer> {
  const page0 = withPlaceholderPhotos(
    coverPage,
    portraitRotationForSeed(seed).map(placeholderPortraitUrl),
  );
  const browser = await launchHeadlessBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 500, height: 700, deviceScaleFactor: 2 });
    await page.goto(`${origin}/proof-render`, { waitUntil: "networkidle0" });

    const doc: DesignDoc = { templateId: "preview", pages: [page0] };
    await page.evaluate((doc) => {
      window.__PROOF_DATA__ = doc;
      window.dispatchEvent(new Event("proof-data-ready"));
    }, doc);

    await page.waitForSelector('[data-proof-ready="true"]', { timeout: 20_000 });
    const handle = await page.waitForSelector('[data-proof-page="0"]', { timeout: 20_000 });
    if (!handle) throw new Error("Preview page did not render");
    const screenshot = await handle.screenshot({ type: "png" });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

/**
 * Persist a rendered thumbnail. Object storage when it's configured — the
 * same place the admin publish flow puts them — otherwise a file under
 * public/ so the tooling still works in development without S3.
 */
export async function saveTemplateThumbnail(slug: string, png: Buffer): Promise<string> {
  if (isStorageConfigured()) {
    return uploadObject(`template-previews/${slug}-${Date.now()}.png`, png, "image/png");
  }
  const dir = path.join(process.cwd(), "public", "templates", slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "cover.png"), png);
  return `/templates/${slug}/cover.png`;
}
