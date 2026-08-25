import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";

import {
  ARTBOARD_H_MM,
  ARTBOARD_W_MM,
  BLEED_MM,
  type ProofRequest,
} from "@/lib/designEditor";

export const runtime = "nodejs";
// Vercel Pro (or higher) is required in production — a single-digit page
// count comfortably fits inside 60s, but this needs raising for large
// booklets. Hobby's 10s ceiling is not enough for a headless-Chromium job.
export const maxDuration = 60;

const MM_TO_PT = 72 / 25.4;
const mmToPt = (mm: number) => mm * MM_TO_PT;

const PAGE_W_PT = mmToPt(ARTBOARD_W_MM);
const PAGE_H_PT = mmToPt(ARTBOARD_H_MM);
const BLEED_PT = mmToPt(BLEED_MM);

/** Print-safe ceiling — matches the largest booklet size sold. */
const MAX_PAGES = 24;

async function launchBrowser() {
  // Vercel's serverless functions run Linux, which @sparticuz/chromium's
  // binary targets; a Mac/Windows dev machine needs a real local Chromium
  // instead, which the full `puppeteer` package downloads on install.
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({ headless: true });
}

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

export async function POST(request: NextRequest) {
  let body: ProofRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pages = body?.doc?.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "doc.pages is required" }, { status: 400 });
  }
  if (pages.length > MAX_PAGES) {
    return NextResponse.json(
      { error: `A proof can have at most ${MAX_PAGES} pages` },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    // deviceScaleFactor 4 at the canvas's 3px/mm base works out to ~305dpi.
    await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 4 });
    await page.goto(`${origin}/proof-render`, { waitUntil: "networkidle0" });

    await page.evaluate((doc) => {
      window.__PROOF_DATA__ = doc;
      window.dispatchEvent(new Event("proof-data-ready"));
    }, body.doc);

    await page.waitForSelector('[data-proof-ready="true"]', { timeout: 20_000 });

    const pdfDoc = await PDFDocument.create();
    for (let index = 0; index < pages.length; index += 1) {
      const selector = `[data-proof-page="${index}"]`;
      const handle = await page.waitForSelector(selector, { timeout: 20_000 });
      if (!handle) throw new Error(`Page ${index} did not render`);
      const screenshot = await handle.screenshot({ type: "png" });

      const image = await pdfDoc.embedPng(screenshot);
      const pdfPage = pdfDoc.addPage([PAGE_W_PT, PAGE_H_PT]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
      drawCropMarks(pdfPage);
    }

    const pdfBytes = await pdfDoc.save();
    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="proof.pdf"',
      },
    });
  } finally {
    await browser.close();
  }
}
