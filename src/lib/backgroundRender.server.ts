/**
 * Turns a source image into a print-ready background: cover-cropped to the
 * artboard (bleed included), tinted toward a palette accent, washed back
 * toward the paper colour, and faded to paper over the text zone so name and
 * dates stay legible on top of it.
 *
 * Rendering happens on a <canvas> inside the shared headless Chromium
 * (launchHeadlessBrowser) rather than through an image library — nothing in
 * package.json does raster processing, and Chromium is already a dependency.
 * The canvas is fed a data: URL so it never taints.
 */

import { ARTBOARD_H_MM, ARTBOARD_W_MM } from "@/lib/designEditor";
import { launchHeadlessBrowser } from "@/lib/headlessBrowser.server";
import type { BackgroundSpec } from "@/lib/backgroundArtwork";

/** Output resolution: the full artboard at 300dpi. */
const OUTPUT_DPI = 300;
export const BACKGROUND_W = Math.round((ARTBOARD_W_MM / 25.4) * OUTPUT_DPI);
export const BACKGROUND_H = Math.round((ARTBOARD_H_MM / 25.4) * OUTPUT_DPI);

const JPEG_QUALITY = 0.92;

export interface BackgroundRenderOptions {
  /** Palette paper colour — what the wash and fades go toward. */
  paper: string;
  /** Palette accent — what the artwork is tinted toward. */
  accent: string;
  focus: { x: number; y: number };
  inset: number;
  placement: { x: number; y: number; w: number; h: number };
  feather: number;
  fade: BackgroundSpec["fade"] | null;
  wash: number;
  tint: number;
}

/** Everything the browser-side draw needs, all plain data. */
interface DrawInput extends BackgroundRenderOptions {
  dataUrl: string;
  width: number;
  height: number;
  quality: number;
}

/**
 * Runs inside Chromium. Kept as one self-contained function (no closures over
 * Node scope) because puppeteer serialises it to a string.
 */
async function drawInBrowser(input: DrawInput): Promise<string> {
  const image = new Image();
  image.src = input.dataUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = input.width;
  canvas.height = input.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const W = input.width;
  const H = input.height;

  ctx.fillStyle = input.paper;
  ctx.fillRect(0, 0, W, H);

  // The artwork's box on the canvas.
  const rx = (input.placement.x / 100) * W;
  const ry = (input.placement.y / 100) * H;
  const rw = (input.placement.w / 100) * W;
  const rh = (input.placement.h / 100) * H;

  // Trim the scan's edges, then cover-crop what's left into the box,
  // anchored on the focus point.
  const ix = image.naturalWidth * input.inset;
  const iy = image.naturalHeight * input.inset;
  const iw = image.naturalWidth - ix * 2;
  const ih = image.naturalHeight - iy * 2;
  const scale = Math.max(rw / iw, rh / ih);
  const sw = rw / scale;
  const sh = rh / scale;
  const sx = ix + (iw - sw) * input.focus.x;
  const sy = iy + (ih - sh) * input.focus.y;
  ctx.drawImage(image, sx, sy, sw, sh, rx, ry, rw, rh);

  // Tint toward the accent (multiply keeps the drawing's own shading), then
  // wash toward paper so text set over it still has contrast.
  if (input.tint > 0) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = input.tint;
    ctx.fillStyle = input.accent;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.globalCompositeOperation = "source-over";
  if (input.wash > 0) {
    ctx.globalAlpha = input.wash;
    ctx.fillStyle = input.paper;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.globalAlpha = 1;

  // Soften the box edges into the paper so a placed plate doesn't read as a
  // pasted-on rectangle.
  const featherPx = (input.feather / 100) * W;
  if (featherPx > 0) {
    const edges: Array<[number, number, number, number]> = [
      [rx, ry, rx + featherPx, ry],
      [rx + rw, ry, rx + rw - featherPx, ry],
      [rx, ry, rx, ry + featherPx],
      [rx, ry + rh, rx, ry + rh - featherPx],
    ];
    for (const [x0, y0, x1, y1] of edges) {
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, input.paper);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  // Fade to paper over the text zone. `start` is fully artwork, `end` fully
  // paper; beyond `end` (toward the edge) is solid paper.
  if (input.fade) {
    const startY = (input.fade.start / 100) * H;
    const endY = (input.fade.end / 100) * H;
    const gradient = ctx.createLinearGradient(0, startY, 0, endY);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, input.paper);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = input.paper;
    if (input.fade.edge === "bottom") ctx.fillRect(0, endY, W, H - endY);
    else ctx.fillRect(0, 0, W, endY);
  }

  return canvas.toDataURL("image/jpeg", input.quality);
}

export interface BackgroundRenderer {
  render(
    source: { bytes: Buffer; contentType: string },
    options: BackgroundRenderOptions,
  ): Promise<Buffer>;
  close(): Promise<void>;
}

/**
 * One browser for a whole run — launching Chromium per image would dominate
 * the runtime. Always `close()` it, including on failure.
 */
export async function createBackgroundRenderer(): Promise<BackgroundRenderer> {
  const browser = await launchHeadlessBrowser();
  return {
    async render(source, options) {
      const page = await browser.newPage();
      try {
        await page.setContent("<!doctype html><html><body></body></html>");
        const dataUrl = `data:${source.contentType};base64,${source.bytes.toString("base64")}`;
        const out = await page.evaluate(drawInBrowser, {
          ...options,
          dataUrl,
          width: BACKGROUND_W,
          height: BACKGROUND_H,
          quality: JPEG_QUALITY,
        });
        const comma = out.indexOf(",");
        return Buffer.from(out.slice(comma + 1), "base64");
      } finally {
        await page.close();
      }
    },
    async close() {
      await browser.close();
    },
  };
}
