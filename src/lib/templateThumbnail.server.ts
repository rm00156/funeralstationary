/**
 * Auto-generates a template's preview thumbnail from the first page of its
 * layout, at publish time — see adminPublishTemplateLayout's caller in
 * /api/admin/templates/[slug]/layout. Reuses the exact same /proof-render
 * target as /api/proof (the real PageCanvas, not a second renderer), just
 * screenshotting one page at screen resolution instead of a full print-DPI
 * booklet.
 */
import { launchHeadlessBrowser } from "@/lib/headlessBrowser.server";
import type { DesignDoc, DesignPage } from "@/lib/designEditor";

export async function renderTemplateThumbnail(
  origin: string,
  coverPage: DesignPage,
): Promise<Buffer> {
  const browser = await launchHeadlessBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 500, height: 700, deviceScaleFactor: 2 });
    await page.goto(`${origin}/proof-render`, { waitUntil: "networkidle0" });

    const doc: DesignDoc = { templateId: "preview", pages: [coverPage] };
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
