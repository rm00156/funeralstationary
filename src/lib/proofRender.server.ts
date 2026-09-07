/**
 * The one place that drives the hidden /proof-render route.
 *
 * Both proof outputs come from the real PageCanvas rendered there — the
 * press PDF and the page images the customer reviews. Keeping the browser
 * session in a single helper is what stops a second renderer creeping in:
 * no layout or font logic is reimplemented anywhere.
 *
 * The two differ in how the page is captured, not in what draws it. Review
 * images are screenshots. The press PDF goes through Chromium's own
 * printer, which emits live text with embedded, subsetted fonts instead of
 * a raster of the screen — the same renderer, just asked for vector output.
 */
import type { Page } from "puppeteer-core";

import type { DesignDoc } from "@/lib/designEditor";
import { launchHeadlessBrowser } from "@/lib/headlessBrowser.server";

/** Print-safe ceiling — matches the largest booklet size sold. */
export const MAX_PROOF_PAGES = 24;

/** ~152dpi — crisp on a retina screen, small enough to load on a phone. */
const REVIEW_SCALE = 2;

const REVIEW_JPEG_QUALITY = 82;

/**
 * Open /proof-render with `doc` loaded and wait until it has settled —
 * fonts loaded, images loaded, layout stable — then hand the page to `capture`.
 * Nothing captures anything before data-proof-ready; that is the whole
 * point of the handshake.
 */
async function withProofPage<T>(
  origin: string,
  doc: DesignDoc,
  options: { print: boolean; deviceScaleFactor?: number },
  capture: (page: Page) => Promise<T>,
): Promise<T> {
  const browser = await launchHeadlessBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 900,
      height: 1000,
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
    });
    await page.goto(`${origin}/proof-render`, { waitUntil: "networkidle0" });

    await page.evaluate(
      (data, print) => {
        window.__PROOF_DATA__ = data;
        window.__PROOF_PRINT__ = print;
        window.dispatchEvent(new Event("proof-data-ready"));
      },
      doc,
      options.print,
    );
    await page.waitForSelector('[data-proof-ready="true"]', { timeout: 20_000 });

    return await capture(page);
  } finally {
    await browser.close();
  }
}

/**
 * The press PDF, straight out of Chromium's printer.
 *
 * `preferCSSPageSize` makes it honour the @page the render target declares,
 * so each artboard lands on one true-size page; `printBackground` keeps the
 * artwork. Text stays text — this is the whole reason the press file is not
 * a screenshot.
 */
export function renderProofPrintPdf(origin: string, doc: DesignDoc): Promise<Uint8Array> {
  return withProofPage(origin, doc, { print: true }, async (page) =>
    page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    }),
  );
}

/**
 * Screen resolution, JPEG — what the customer reviews and approves. A
 * print-resolution page is tens of megabytes; nobody should be asked to
 * download that to check a date, and it is the press's file, not theirs.
 */
export function renderProofPageImages(origin: string, doc: DesignDoc): Promise<Uint8Array[]> {
  return withProofPage(
    origin,
    doc,
    { print: false, deviceScaleFactor: REVIEW_SCALE },
    async (page) => {
      const shots: Uint8Array[] = [];
      for (let index = 0; index < doc.pages.length; index += 1) {
        const handle = await page.waitForSelector(`[data-proof-page="${index}"]`, {
          timeout: 20_000,
        });
        if (!handle) throw new Error(`Page ${index} did not render`);
        shots.push(await handle.screenshot({ type: "jpeg", quality: REVIEW_JPEG_QUALITY }));
      }
      return shots;
    },
  );
}
