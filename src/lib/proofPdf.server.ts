/**
 * Print-ready PDF rendering for a DesignDoc.
 *
 * Shared by POST /api/proof (the editor's "Download proof") and the order
 * fulfilment path (proofs generated after payment, and admin regeneration).
 * It screenshots the real PageCanvas via the hidden /proof-render route so
 * the PDF is pixel-identical to the editor — never reimplement the layout
 * as a second renderer. proofRender.server.ts is the only Chromium entry.
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
import { renderProofPagePngs } from "@/lib/proofRender.server";

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
  const shots = await renderProofPagePngs(origin, doc);

  const pdfDoc = await PDFDocument.create();
  for (const shot of shots) {
    const image = await pdfDoc.embedPng(shot);
    const pdfPage = pdfDoc.addPage([PAGE_W_PT, PAGE_H_PT]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
    drawCropMarks(pdfPage);
  }

  return Buffer.from(await pdfDoc.save());
}
