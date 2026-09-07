/**
 * Print-ready PDF rendering for a DesignDoc.
 *
 * Shared by POST /api/proof (the editor's "Download proof") and the order
 * fulfilment path (proofs generated after payment, and admin regeneration).
 * It screenshots the real PageCanvas via the hidden /proof-render route so
 * the PDF is pixel-identical to the editor — never reimplement the layout
 * as a second renderer. launchHeadlessBrowser is the only Chromium entry.
 */
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";

import {
  ARTBOARD_H_MM,
  ARTBOARD_W_MM,
  BLEED_MM,
  type DesignDoc,
} from "@/lib/designEditor";
import { launchHeadlessBrowser } from "@/lib/headlessBrowser.server";

const MM_TO_PT = 72 / 25.4;
const mmToPt = (mm: number) => mm * MM_TO_PT;

const PAGE_W_PT = mmToPt(ARTBOARD_W_MM);
const PAGE_H_PT = mmToPt(ARTBOARD_H_MM);
const BLEED_PT = mmToPt(BLEED_MM);

/** Print-safe ceiling — matches the largest booklet size sold. */
export const MAX_PROOF_PAGES = 24;

/** Two short ticks per corner, anchored at the trim line, in the bleed margin. */
function drawCropMarks(page: PDFPage) {
  const gap = BLEED_PT * 0.3;
  const color = rgb(0, 0, 0);
  const corners = [
    { cx: BLEED_PT, cy: PAGE_H_PT - BLEED_PT, sx: -1, sy: 1 },
    { cx: PAGE_W_PT - BLEED_PT, cy: PAGE_H_PT - BLEED_PT, sx: 1, sy: 1 },
    { cx: BLEED_PT, cy: BLEED_PT, sx: -1, sy: -1 },
    { cx: PAGE_W_PT - BLEED_PT, cy: BLEED_PT, sx: 1, sy: -1 },
  ];
  for (const { cx, cy, sx, sy } of corners) {
    page.drawLine({
      start: { x: cx + sx * gap, y: cy },
      end: { x: cx + sx * BLEED_PT, y: cy },
      thickness: 0.75,
      color,
    });
    page.drawLine({
      start: { x: cx, y: cy + sy * gap },
      end: { x: cx, y: cy + sy * BLEED_PT },
      thickness: 0.75,
      color,
    });
  }
}

/**
 * Render every page of `doc` to a bleed-sized PDF with crop marks. `origin`
 * is the site origin /proof-render is served from (derive it from the
 * incoming request, as every caller does).
 */
export async function renderProofPdf(origin: string, doc: DesignDoc): Promise<Buffer> {
  const browser = await launchHeadlessBrowser();

  try {
    const page = await browser.newPage();
    // deviceScaleFactor 4 at the canvas's 3px/mm base works out to ~305dpi.
    await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 4 });
    await page.goto(`${origin}/proof-render`, { waitUntil: "networkidle0" });

    await page.evaluate((data) => {
      window.__PROOF_DATA__ = data;
      window.dispatchEvent(new Event("proof-data-ready"));
    }, doc);

    await page.waitForSelector('[data-proof-ready="true"]', { timeout: 20_000 });

    const pdfDoc = await PDFDocument.create();
    for (let index = 0; index < doc.pages.length; index += 1) {
      const selector = `[data-proof-page="${index}"]`;
      const handle = await page.waitForSelector(selector, { timeout: 20_000 });
      if (!handle) throw new Error(`Page ${index} did not render`);
      const screenshot = await handle.screenshot({ type: "png" });

      const image = await pdfDoc.embedPng(screenshot);
      const pdfPage = pdfDoc.addPage([PAGE_W_PT, PAGE_H_PT]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
      drawCropMarks(pdfPage);
    }

    return Buffer.from(await pdfDoc.save());
  } finally {
    await browser.close();
  }
}
