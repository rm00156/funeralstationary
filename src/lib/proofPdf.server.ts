/**
 * Print-ready PDF rendering for a DesignDoc.
 *
 * Shared by POST /api/proof (the editor's "Download proof") and the order
 * fulfilment path (proofs generated after payment, and admin regeneration).
 * The pages come out of Chromium's own printer, driving the real
 * PageCanvas on the hidden /proof-render route — so the file matches what
 * the customer saw, with live text and embedded fonts rather than a raster
 * of the screen. Never reimplement the layout as a second renderer (drawing
 * text or shapes directly with pdf-lib); pdf-lib's job here is limited to
 * marks and metadata on pages Chromium produced. proofRender.server.ts is
 * the only Chromium entry.
 *
 * This is the press artefact. Customers never receive it; they review the
 * page images rendered by renderProofPageImages.
 */
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";

import {
  ARTBOARD_H_MM,
  ARTBOARD_W_MM,
  BLEED_MM,
  type DesignDoc,
} from "@/lib/designEditor";
import { renderProofPrintPdf } from "@/lib/proofRender.server";

const MM_TO_PT = 72 / 25.4;
const mmToPt = (mm: number) => mm * MM_TO_PT;

const PAGE_W_PT = mmToPt(ARTBOARD_W_MM);
const PAGE_H_PT = mmToPt(ARTBOARD_H_MM);
const BLEED_PT = mmToPt(BLEED_MM);

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
  const printed = await renderProofPrintPdf(origin, doc);
  const pdfDoc = await PDFDocument.load(printed);

  const pages = pdfDoc.getPages();
  // One artboard per sheet. A mismatch means the print layout has broken
  // (a page overflowing onto a second sheet, say) and the file would go to
  // press wrong — fail loudly rather than ship it.
  if (pages.length !== doc.pages.length) {
    throw new Error(
      `Print layout produced ${pages.length} sheets for ${doc.pages.length} pages`,
    );
  }
  for (const pdfPage of pages) {
    const { width, height } = pdfPage.getSize();
    if (Math.abs(width - PAGE_W_PT) > 1 || Math.abs(height - PAGE_H_PT) > 1) {
      throw new Error(
        `Print layout produced a ${width.toFixed(1)}x${height.toFixed(1)}pt sheet, ` +
          `expected ${PAGE_W_PT.toFixed(1)}x${PAGE_H_PT.toFixed(1)}pt`,
      );
    }
    drawCropMarks(pdfPage);
  }

  return Buffer.from(await pdfDoc.save());
}
