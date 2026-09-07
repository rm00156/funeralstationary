/**
 * The one place that drives the hidden /proof-render route.
 *
 * Both proof outputs come from screenshotting the real PageCanvas there —
 * the print-ready PDF for the press and the page images the customer
 * reviews. Keeping the browser session in a single helper is what stops a
 * second renderer creeping in: no layout or font logic is reimplemented
 * anywhere, only the resolution and image format differ.
 */
import type { DesignDoc } from "@/lib/designEditor";
import { launchHeadlessBrowser } from "@/lib/headlessBrowser.server";

/** Print-safe ceiling — matches the largest booklet size sold. */
export const MAX_PROOF_PAGES = 24;

/** ~305dpi against the canvas's 3px/mm base. */
const PRINT_SCALE = 4;
/** ~152dpi — crisp on a retina screen, small enough to load on a phone. */
const REVIEW_SCALE = 2;

const REVIEW_JPEG_QUALITY = 82;

interface ShotOptions {
  deviceScaleFactor: number;
  type: "png" | "jpeg";
  quality?: number;
}

/**
 * Screenshot every `[data-proof-page]` element of `doc`, in order. `origin`
 * is the site origin /proof-render is served from (derive it from the
 * incoming request, as every caller does).
 */
async function screenshotProofPages(
  origin: string,
  doc: DesignDoc,
  options: ShotOptions,
): Promise<Uint8Array[]> {
  const browser = await launchHeadlessBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 900,
      height: 1000,
      deviceScaleFactor: options.deviceScaleFactor,
    });
    await page.goto(`${origin}/proof-render`, { waitUntil: "networkidle0" });

    await page.evaluate((data) => {
      window.__PROOF_DATA__ = data;
      window.dispatchEvent(new Event("proof-data-ready"));
    }, doc);

    // Fonts loaded, images loaded, two stable frames — never shoot early.
    await page.waitForSelector('[data-proof-ready="true"]', { timeout: 20_000 });

    const shots: Uint8Array[] = [];
    for (let index = 0; index < doc.pages.length; index += 1) {
      const handle = await page.waitForSelector(`[data-proof-page="${index}"]`, {
        timeout: 20_000,
      });
      if (!handle) throw new Error(`Page ${index} did not render`);
      shots.push(
        await handle.screenshot({ type: options.type, quality: options.quality }),
      );
    }
    return shots;
  } finally {
    await browser.close();
  }
}

/** Print resolution, lossless — for embedding in the press PDF. */
export function renderProofPagePngs(origin: string, doc: DesignDoc): Promise<Uint8Array[]> {
  return screenshotProofPages(origin, doc, { deviceScaleFactor: PRINT_SCALE, type: "png" });
}

/**
 * Screen resolution, JPEG — what the customer reviews and approves. A
 * print-resolution page is tens of megabytes; nobody should be asked to
 * download that to check a date, and it is the press's file, not theirs.
 */
export function renderProofPageImages(origin: string, doc: DesignDoc): Promise<Uint8Array[]> {
  return screenshotProofPages(origin, doc, {
    deviceScaleFactor: REVIEW_SCALE,
    type: "jpeg",
    quality: REVIEW_JPEG_QUALITY,
  });
}
