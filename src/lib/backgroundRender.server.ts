/**
 * Turns a source image into print-ready template artwork, in two modes:
 *
 * - **background**: cover-cropped to the artboard (bleed included), tinted
 *   toward a palette accent, washed back toward the paper colour, and faded
 *   to paper over the text zone.
 * - **spray**: the specimen cut out of its plain ground to transparent PNG,
 *   trimmed to its own bounds, so it can be placed as a corner or edge accent
 *   over a photo-led layout — which is how funeral stationery actually uses
 *   florals (the artwork frames the person, it doesn't replace them).
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

/**
 * Working resolution for a cutout, long edge. A spray occupies at most ~half
 * the page (~75mm), which is ~890px at 300dpi, so this is comfortably above
 * print resolution while keeping the flood fill to a few million pixels.
 */
const SPRAY_MAX_EDGE = 1600;

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

export interface SprayRenderOptions {
  /**
   * How far a pixel may sit from the sampled ground colour and still count as
   * background, as a 0-255 RGB distance. Higher lifts more of a mottled or
   * foxed scan; too high starts eating pale petals.
   */
  tolerance: number;
  /** Fraction trimmed from each side before cutting out, as for backgrounds. */
  inset: number;
  /**
   * Extra fraction dropped from the bottom before cutting. These plates carry
   * an engraved caption there ("Rosa centifolia foliacea"), which is neither
   * ground nor specimen, so a cut keeps it unless it's cropped away first.
   */
  cropBottom: number;
  /**
   * Also clear ground-coloured regions enclosed by the specimen — the gap
   * framed by a pair of crossing stems, say, which a fill from the border
   * can't reach. Expressed as the smallest fraction of the image such a
   * region must cover to count, so specular highlights inside petals survive.
   * Set to 0 for a pale specimen whose own body reads as ground.
   */
  minEnclosedRegion: number;
}

/**
 * Runs inside Chromium. Cuts the specimen out of its ground and returns a
 * trimmed PNG.
 *
 * The ground is found by **flood fill inward from the image border**, not by
 * a global brightness threshold: a white flower on cream paper (Lilium
 * candidum) would lose its petals to a threshold, but its petals aren't
 * connected to the border, so a fill leaves them intact.
 */
async function drawSprayInBrowser(input: {
  dataUrl: string;
  tolerance: number;
  inset: number;
  cropBottom: number;
  minEnclosedRegion: number;
  maxEdge: number;
}): Promise<string | null> {
  const image = new Image();
  image.src = input.dataUrl;
  await image.decode();

  // Trim the scan edge, then downscale to the working resolution.
  const ix = image.naturalWidth * input.inset;
  const iy = image.naturalHeight * input.inset;
  const iw = image.naturalWidth - ix * 2;
  const ih = image.naturalHeight - iy * 2 - image.naturalHeight * input.cropBottom;
  const scale = Math.min(1, input.maxEdge / Math.max(iw, ih));
  const W = Math.max(1, Math.round(iw * scale));
  const H = Math.max(1, Math.round(ih * scale));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(image, ix, iy, iw, ih, 0, 0, W, H);

  const img = ctx.getImageData(0, 0, W, H);
  const px = img.data;

  // Ground colour: median-ish sample of the four corners.
  const corners = [
    [2, 2],
    [W - 3, 2],
    [2, H - 3],
    [W - 3, H - 3],
  ];
  let gr = 0;
  let gg = 0;
  let gb = 0;
  for (const [cx, cy] of corners) {
    const i = (cy * W + cx) * 4;
    gr += px[i];
    gg += px[i + 1];
    gb += px[i + 2];
  }
  gr /= 4;
  gg /= 4;
  gb /= 4;

  const tol2 = input.tolerance * input.tolerance;
  const isGround = (i: number) => {
    const dr = px[i] - gr;
    const dg = px[i + 1] - gg;
    const db = px[i + 2] - gb;
    return dr * dr + dg * dg + db * db <= tol2;
  };

  // Scanline flood fill from every border pixel.
  const outside = new Uint8Array(W * H);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * W + x;
    if (!outside[p] && isGround(p * 4)) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % W;
    const y = (p - x) / W;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }

  // Ground-coloured pockets the border fill couldn't reach, e.g. the space
  // framed by crossing stems. Only regions above the size floor, so small
  // pale flecks inside the specimen aren't punched through.
  if (input.minEnclosedRegion > 0) {
    const minArea = Math.max(1, Math.floor(W * H * input.minEnclosedRegion));
    const seen = new Uint8Array(W * H);
    for (let start = 0; start < W * H; start++) {
      if (outside[start] || seen[start] || !isGround(start * 4)) continue;
      const region: number[] = [];
      const queue = [start];
      seen[start] = 1;
      while (queue.length) {
        const p = queue.pop()!;
        region.push(p);
        const x = p % W;
        const y = (p - x) / W;
        const neighbours = [
          x > 0 ? p - 1 : -1,
          x < W - 1 ? p + 1 : -1,
          y > 0 ? p - W : -1,
          y < H - 1 ? p + W : -1,
        ];
        for (const q of neighbours) {
          if (q < 0 || seen[q] || outside[q] || !isGround(q * 4)) continue;
          seen[q] = 1;
          queue.push(q);
        }
      }
      if (region.length >= minArea) for (const p of region) outside[p] = 1;
    }
  }

  // Alpha from the mask, then a small box blur so edges aren't jagged.
  const alpha = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = outside[p] ? 0 : 255;
  const R = 2;
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      for (let d = -R; d <= R; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= W) continue;
        sum += alpha[y * W + xx];
        n++;
      }
      tmp[y * W + x] = sum / n;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let sum = 0;
      let n = 0;
      for (let d = -R; d <= R; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= H) continue;
        sum += tmp[yy * W + x];
        n++;
      }
      alpha[y * W + x] = sum / n;
    }
  }

  // Bounding box of everything meaningfully opaque, so the spray is tight.
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha[y * W + x] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;

  // Sanity check: if almost nothing was removed, the ground was never
  // identified — a dark mount under the corner samplers, or a tolerance too
  // tight for a toned scan. Returning null makes that a loud failure rather
  // than a plate-shaped rectangle pasted onto a template.
  let opaque = 0;
  for (let p = 0; p < W * H; p++) if (alpha[p] > 200) opaque++;
  if (opaque / (W * H) > 0.9) return null;

  for (let p = 0; p < W * H; p++) px[p * 4 + 3] = alpha[p];
  ctx.putImageData(img, 0, 0);

  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("2d context unavailable");
  octx.drawImage(canvas, minX, minY, outW, outH, 0, 0, outW, outH);
  return out.toDataURL("image/png");
}

export interface BackgroundRenderer {
  render(
    source: { bytes: Buffer; contentType: string },
    options: BackgroundRenderOptions,
  ): Promise<Buffer>;
  /** Cut the specimen out of its ground. Null when nothing survived the cut. */
  renderSpray(
    source: { bytes: Buffer; contentType: string },
    options: SprayRenderOptions,
  ): Promise<Buffer | null>;
  close(): Promise<void>;
}

/**
 * One browser for a whole run — launching Chromium per image would dominate
 * the runtime. Always `close()` it, including on failure.
 */
export async function createBackgroundRenderer(): Promise<BackgroundRenderer> {
  const browser = await launchHeadlessBrowser();

  /**
   * A blank page, prepared for page.evaluate.
   *
   * The `__name` shim matters: tsx/esbuild compiles with keepNames, which
   * wraps inner named functions in a `__name(...)` helper. That helper is
   * emitted in the Node bundle, not in the function body puppeteer serialises
   * across to the browser, so any evaluated function containing an inner
   * function throws "__name is not defined" without it. Passed as a string so
   * the shim itself can't be rewritten the same way.
   */
  const blankPage = async () => {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.evaluate("globalThis.__name = globalThis.__name || ((fn) => fn)");
    return page;
  };

  return {
    async render(source, options) {
      const page = await blankPage();
      try {
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
    async renderSpray(source, options) {
      const page = await blankPage();
      try {
        const dataUrl = `data:${source.contentType};base64,${source.bytes.toString("base64")}`;
        const out = await page.evaluate(drawSprayInBrowser, {
          ...options,
          dataUrl,
          maxEdge: SPRAY_MAX_EDGE,
        });
        if (!out) return null;
        return Buffer.from(out.slice(out.indexOf(",") + 1), "base64");
      } finally {
        await page.close();
      }
    },
    async close() {
      await browser.close();
    },
  };
}
