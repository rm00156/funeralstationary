/**
 * The themed family: the rest of the business's own range — crosses for a
 * religious service, landscapes, sports, music, and covers for a family's
 * heritage — rebuilt the same way as the classic family (classicTemplates.ts),
 * whose builders and placeholder wording these share.
 *
 * Flat, many-coloured artwork (a flag, a rainbow, a sunburst, the Jamaican
 * butterfly) is drawn as SVG under public/elements/templates/ and placed as a
 * locked image, so it ships with the code and prints as vector. Photographs
 * come from the background pipeline (backgroundArtwork.ts): a design that
 * needs one names it, and the runner hands the rendered URL in through
 * `ArtworkUrls`, so this module stays pure.
 */

import {
  ADDRESS,
  CHURCH,
  DATES_LONG,
  GREY_INK,
  GREY_MUTED,
  SERVICE_DAY,
  SERVICE_TIME,
  SERVICE_WHEN,
  SERVICE_WHEN_AT,
  SERVICE_WHEN_LINE,
  SUNRISE_SUNSET,
  SUNRISE_SUNSET_STACKED,
  VENUE,
  VENUE_LINE,
  VENUE_SHORT,
  VENUE_TWO_LINES,
  aspectBox,
  buildDesignPages,
  field,
  fixed,
  frame,
  ornament,
  photo,
  shape,
  squareH,
  type ClassicDesign,
  type PageType,
} from "@/lib/classicTemplates";
import { FULL_BLEED_BOX, uid, type CanvasElement, type DesignPage } from "@/lib/designEditor";
import type { PlaceholderPortraitId } from "@/lib/placeholderPortraits";
import {
  PLACEHOLDER_NAME,
  PLACEHOLDER_OFFICIANT,
  slugForName,
  type PaletteId,
} from "@/lib/templateGenerator";

/** Rendered photographs a design draws on; see the module comment. */
export interface ArtworkUrls {
  /** A rendered background (BACKGROUND_SPECS id) in one of its palettes. */
  background: (id: string, palette: PaletteId) => string;
  /** A rendered cutout spray (BACKGROUND_SPECS id). */
  spray: (id: string) => string;
}

/** Where the SVG artwork ships: public/elements/templates/. */
export const ARTWORK_PATH = "/elements/templates";

const art = (file: string) => `${ARTWORK_PATH}/${file}`;

/** Template artwork placed on the page: locked, never cropped. */
const artwork = (src: string, box: { x: number; y: number; w: number; h: number }): CanvasElement => ({
  id: uid("image"),
  type: "image",
  src,
  shape: "rect",
  fit: "contain",
  locked: true,
  ...box,
});

/** A full-bleed ground — the page's whole artboard, bleed included. */
const ground = (src: string): CanvasElement => ({
  id: uid("image"),
  type: "image",
  src,
  shape: "rect",
  locked: true,
  ...FULL_BLEED_BOX,
});

/** A clipart ornament at each corner of a box, rotated to face inward. */
const corners = (icon: string, color: string, box: { x: number; y: number; w: number; h: number }, size: number) => {
  const h = squareH(size);
  return [
    [box.x, box.y, 0],
    [box.x + box.w, box.y, 90],
    [box.x + box.w, box.y + box.h, 180],
    [box.x, box.y + box.h, 270],
  ].map(([cx, cy, rotation]) =>
    ornament({ icon, color, rotation, x: cx - size / 2, y: cy - h / 2, w: size, h }),
  );
};

const plainInterior = (type: Omit<PageType, "paper">): ClassicDesign["interior"] => ({
  type: { paper: "#ffffff", ...type },
  chrome: () => [],
});

/* ------------------------------------------------------------------ */
/* Religious                                                           */
/* ------------------------------------------------------------------ */

function celticCross(): ClassicDesign {
  const ink = "#1f1f1f";
  const box = { x: 3.3, y: 2.4, w: 93.4, h: 95.2 };
  return {
    paper: "#ffffff",
    chrome: () => [
      shape({ shape: "rect", color: ink, strokeWidth: 2, ...box }),
      frame({ variant: "single", color: ink, x: box.x + 1.2, y: box.y + 0.9, w: box.w - 2.4, h: box.h - 1.8 }),
      ...corners("corner-knot", ink, box, 3),
    ],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "pinyonScript", fontSize: 26, color: ink, x: 10, y: 10.6, w: 80, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 24, bold: true, uppercase: true, color: ink, x: 8, y: 16.6, w: 84, h: 0 }),
      photo({ border: "single", borderColor: ink, x: 31.9, y: 23.3, w: 36.4, h: 32.1 }),
      field({ text: DATES_LONG, fontFamily: "ebGaramond", fontSize: 12, bold: true, color: ink, x: 15, y: 57.4, w: 70, h: 0 }),
      ornament({ icon: "celtic-cross", color: "#4a4a4a", ...aspectBox(43.3, 61.7, 13.4, 20 / 32) }),
      fixed({ text: "Requiem Mass", fontFamily: "ebGaramond", fontSize: 13, bold: true, color: ink, x: 25, y: 79, w: 50, h: 0 }),
      field({ text: `${SERVICE_WHEN_LINE}\n${CHURCH}\n${ADDRESS}`, fontFamily: "ebGaramond", fontSize: 12.5, bold: true, color: ink, x: 12, y: 81.8, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: ink },
  };
}

function greyCross(): ClassicDesign {
  const grey = "#9a9a9a";
  const ink = "#555555";
  const box = { x: 4.3, y: 2.4, w: 91.9, h: 95.2 };
  return {
    paper: "#ffffff",
    chrome: () => [
      frame({ variant: "single", color: grey, ...box }),
      frame({ variant: "single", color: grey, x: box.x + 1.2, y: box.y + 0.9, w: box.w - 2.4, h: box.h - 1.8 }),
      ...corners("corner-curl", grey, { x: box.x + 1.6, y: box.y + 1.2, w: box.w - 3.2, h: box.h - 2.4 }, 4),
    ],
    cover: () => [
      ornament({ icon: "budded-cross", color: "#a8a8a8", ...aspectBox(44.1, 6.4, 11.8, 20 / 32) }),
      photo({ shape: "oval", border: "single", borderColor: "#8a8a8a", x: 32.2, y: 22.6, w: 35.6, h: 28.2 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 18, uppercase: true, letterSpacing: 0.5, color: ink, x: 10, y: 58.4, w: 80, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 12, color: ink, x: 8, y: 64.2, w: 84, h: 0 }),
      fixed({ text: "Service:", fontFamily: "ebGaramond", fontSize: 12.5, italic: true, color: ink, x: 30, y: 69.4, w: 40, h: 0 }),
      field({ text: `${CHURCH}\n${SERVICE_DAY}\n${SERVICE_TIME}`, fontFamily: "ebGaramond", fontSize: 11.5, color: "#7a7a7a", x: 20, y: 72, w: 60, h: 0 }),
      fixed({ text: "Reception:", fontFamily: "ebGaramond", fontSize: 12.5, italic: true, color: ink, x: 30, y: 81.6, w: 40, h: 0 }),
      field({ text: "The Crown, High Street\nReading RG1 1AA", fontFamily: "ebGaramond", fontSize: 11.5, color: "#7a7a7a", x: 20, y: 84.2, w: 60, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink, muted: "#7a7a7a", accent: grey },
  };
}

function newCross(): ClassicDesign {
  const gold = "#e3c46a";
  const ink = GREY_INK;
  const box = { x: 8.8, y: 6.6, w: 82.4, h: 87.4 };
  const cross = 8.4;
  const crossH = squareH(cross) / (20 / 32);
  return {
    paper: "#ffffff",
    chrome: () => [
      frame({ variant: "single", color: gold, ...box }),
      ...[box.x, box.x + box.w].map((cx) =>
        ornament({ icon: "budded-cross", color: gold, x: cx - cross / 2, y: box.y - crossH / 2, w: cross, h: crossH }),
      ),
    ],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "pinyonScript", fontSize: 26, color: ink, x: 14, y: 10.6, w: 72, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 23, bold: true, uppercase: true, color: ink, x: 11, y: 16.8, w: 78, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: ink, x: 11, y: 22.8, w: 78, h: 0 }),
      photo({ border: "single", borderColor: gold, x: 31, y: 28.4, w: 38.6, h: 32.4 }),
      ornament({ icon: "swash", color: gold, ...aspectBox(38, 63.4, 24, 4) }),
      field({ text: SERVICE_WHEN_AT, fontFamily: "ebGaramond", fontSize: 12.5, bold: true, color: ink, x: 20, y: 68.8, w: 60, h: 0 }),
      field({ text: VENUE, fontFamily: "ebGaramond", fontSize: 12.5, bold: true, color: ink, x: 15, y: 75.6, w: 70, h: 0 }),
      field({ text: PLACEHOLDER_OFFICIANT, fontFamily: "ebGaramond", fontSize: 12, italic: true, color: ink, x: 12, y: 84.4, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: gold },
  };
}

function crossDoves(): ClassicDesign {
  const violet = "#4a4fa3";
  const ink = "#2f2f45";
  return {
    paper: "#f3d9ea",
    chrome: () => [],
    cover: () => [
      fixed({ text: "In ever loving memory of", fontFamily: "pinyonScript", fontSize: 24, color: violet, x: 10, y: 5.8, w: 80, h: 0 }),
      shape({ shape: "rect", color: "#ffffff", fill: "#ffffff", strokeWidth: 1, x: 25.9, y: 12.8, w: 48.9, h: 41.1 }),
      photo({ x: 26.9, y: 13.5, w: 46.9, h: 39.7 }),
      ornament({ icon: "budded-cross", color: violet, ...aspectBox(44.6, 56.2, 10.8, 20 / 32) }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 17, bold: true, uppercase: true, color: violet, x: 10, y: 71.8, w: 80, h: 0 }),
      field({ text: "(fondly known as Bob)", fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 15, y: 75.6, w: 70, h: 0 }),
      field({ text: "Aged 88", fontFamily: "ebGaramond", fontSize: 11.5, bold: true, color: ink, x: 30, y: 78.6, w: 40, h: 0 }),
      field({ text: SUNRISE_SUNSET_STACKED, fontFamily: "ebGaramond", fontSize: 11.5, bold: true, color: violet, x: 25, y: 81.6, w: 50, h: 0 }),
      ornament({ icon: "dove", color: "#9a9aa8", ...aspectBox(13, 79.8, 15, 64 / 48) }),
      artwork(art("lily.svg"), { x: 70.5, y: 77.6, w: 15, h: squareH(15) * (36 / 30) }),
      fixed({ text: "Rest in perfect peace with the Lord", fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 12, y: 91.2, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: violet },
  };
}

function religiousCross1(): ClassicDesign {
  const ink = "#1f1f1f";
  return {
    paper: "#ffffff",
    chrome: () => [frame({ variant: "single", corners: "notched", color: ink, x: 7.1, y: 4.7, w: 85.8, h: 92.9 })],
    cover: () => [
      fixed({ text: "In Loving Memory", fontFamily: "ebGaramond", fontSize: 13, uppercase: true, color: ink, x: 20, y: 9.2, w: 60, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 26, uppercase: true, color: ink, x: 9, y: 13.3, w: 82, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 9, y: 20.4, w: 82, h: 0 }),
      photo({ border: "single", borderColor: ink, x: 28.1, y: 25, w: 44.5, h: 34.6 }),
      ornament({ icon: "latin-cross", color: ink, ...aspectBox(46.5, 62.8, 7, 20 / 32) }),
      fixed({ text: "Service", fontFamily: "ebGaramond", fontSize: 13, bold: true, italic: true, color: ink, x: 30, y: 74.2, w: 40, h: 0 }),
      field({ text: `${SERVICE_WHEN}\n${VENUE}`, fontFamily: "ebGaramond", fontSize: 11.5, bold: true, italic: true, color: ink, x: 15, y: 77.2, w: 70, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: ink },
  };
}

function religiousCross2(): ClassicDesign {
  const ink = GREY_INK;
  return {
    paper: "#ffffff",
    chrome: () => [],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "ebGaramond", fontSize: 13, color: ink, x: 20, y: 7.4, w: 60, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 18, bold: true, uppercase: true, color: ink, x: 10, y: 11.6, w: 80, h: 0 }),
      photo({ x: 26.3, y: 20, w: 45.7, h: 36.3 }),
      field({ text: DATES_LONG, fontFamily: "ebGaramond", fontSize: 11.5, color: ink, x: 15, y: 60.8, w: 70, h: 0 }),
      ornament({ icon: "outline-cross", color: ink, ...aspectBox(43.8, 65.7, 11.2, 20 / 32) }),
      field({ text: VENUE_LINE, fontFamily: "ebGaramond", fontSize: 11.5, color: ink, x: 8, y: 80.8, w: 84, h: 0 }),
      field({ text: SERVICE_DAY, fontFamily: "ebGaramond", fontSize: 12.5, bold: true, color: ink, x: 20, y: 85.6, w: 60, h: 0 }),
      field({ text: PLACEHOLDER_OFFICIANT, fontFamily: "ebGaramond", fontSize: 11.5, bold: true, italic: true, color: ink, x: 15, y: 90.6, w: 70, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#8a8a8a" },
  };
}

/* ------------------------------------------------------------------ */
/* Heritage and the rest                                               */
/* ------------------------------------------------------------------ */

function brownHeart(): ClassicDesign {
  const maroon = "#7a1f2e";
  return {
    paper: "#ffffff",
    chrome: () => [
      shape({ shape: "rect", color: maroon, strokeWidth: 3, x: 5.2, y: 3.7, w: 89.6, h: 93.4 }),
      ornament({ icon: "heart-branch", color: maroon, x: 0, y: 0, w: 27, h: squareH(27) }),
    ],
    cover: () => [
      fixed({ text: "A Celebration Of The Life Of", fontFamily: "pinyonScript", fontSize: 22, color: maroon, x: 25, y: 11.4, w: 66, h: 0 }),
      photo({ x: 29.5, y: 22.8, w: 41.9, h: 38.3 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 18, uppercase: true, letterSpacing: 0.5, color: maroon, x: 10, y: 68.4, w: 80, h: 0 }),
      field({ text: DATES_LONG, fontFamily: "ebGaramond", fontSize: 11.5, color: GREY_INK, x: 15, y: 73.4, w: 70, h: 0 }),
      field({ text: SERVICE_DAY, fontFamily: "ebGaramond", fontSize: 13, color: GREY_INK, x: 15, y: 77.4, w: 70, h: 0 }),
      fixed({ text: "at", fontFamily: "ebGaramond", fontSize: 10, color: GREY_MUTED, x: 40, y: 80.6, w: 20, h: 0 }),
      field({ text: VENUE_SHORT, fontFamily: "ebGaramond", fontSize: 12, bold: true, color: GREY_INK, x: 15, y: 82.8, w: 70, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: maroon, muted: GREY_INK, accent: maroon },
  };
}

/** Two coloured rules around the page and the portrait — a national pair. */
function tricolour({
  outer,
  inner,
  name,
  motto,
  sunrise,
  service,
}: {
  outer: string;
  inner: string;
  name: string;
  motto: string;
  sunrise: string;
  service: string;
}): ClassicDesign {
  return {
    paper: "#ffffff",
    chrome: () => [
      shape({ shape: "rect", color: outer, strokeWidth: 2.5, x: 3, y: 2.2, w: 94, h: 95.6 }),
      shape({ shape: "rect", color: inner, strokeWidth: 2.5, x: 5, y: 3.6, w: 90, h: 92.8 }),
    ],
    cover: () => [
      field({ text: PLACEHOLDER_NAME, fontFamily: "cormorant", fontSize: 26, color: name, x: 10, y: 11.2, w: 80, h: 0 }),
      fixed({ text: motto, fontFamily: "raleway", fontSize: 11, italic: true, color: inner, x: 10, y: 17.6, w: 80, h: 0 }),
      shape({ shape: "rect", color: outer, strokeWidth: 1.5, x: 29.3, y: 23.7, w: 41.4, h: 36.4 }),
      photo({ border: "single", borderColor: inner, x: 30.8, y: 24.8, w: 38.4, h: 34.2 }),
      field({ text: sunrise, fontFamily: "lato", fontSize: 11, bold: true, color: GREY_INK, x: 10, y: 64.4, w: 80, h: 0 }),
      field({ text: service, fontFamily: "lato", fontSize: 11, color: GREY_INK, x: 10, y: 70.4, w: 80, h: 0 }),
    ],
    type: { heading: "cormorant", body: "lato", script: "pinyonScript", ink: GREY_INK, muted: GREY_MUTED, accent: inner },
  };
}

function jamaicanButterfly(): ClassicDesign {
  const green = "#2f9a3a";
  const ink = GREY_INK;
  return {
    paper: "#ffffff",
    chrome: () => [frame({ variant: "single", color: green, x: 5.2, y: 2.4, w: 91, h: 95.2 })],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "allura", fontSize: 24, color: ink, x: 20, y: 4.6, w: 60, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 19, bold: true, uppercase: true, color: green, x: 8, y: 11.6, w: 84, h: 0 }),
      field({ text: "(Known as Bob)", fontFamily: "ebGaramond", fontSize: 11.5, uppercase: true, color: green, x: 20, y: 15.8, w: 60, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 8, y: 20.2, w: 84, h: 0 }),
      photo({ shape: "oval", x: 27.4, y: 25.3, w: 50, h: 41.4 }),
      shape({ shape: "circle", color: green, strokeWidth: 3, x: 27.4, y: 25.3, w: 50, h: 41.4 }),
      fixed({ text: "Service to be held at:", fontFamily: "ebGaramond", fontSize: 11.5, bold: true, italic: true, align: "left", color: green, x: 11.9, y: 72.8, w: 50, h: 0 }),
      field({ text: VENUE, fontFamily: "ebGaramond", fontSize: 11, align: "left", color: ink, x: 11.9, y: 75.4, w: 50, h: 0 }),
      fixed({ text: "On", fontFamily: "ebGaramond", fontSize: 10.5, align: "left", color: ink, x: 11.9, y: 83.8, w: 20, h: 0 }),
      field({ text: SERVICE_DAY, fontFamily: "ebGaramond", fontSize: 11, italic: true, align: "left", color: ink, x: 11.9, y: 86, w: 50, h: 0 }),
      fixed({ text: "At", fontFamily: "ebGaramond", fontSize: 10.5, align: "left", color: ink, x: 11.9, y: 88.4, w: 20, h: 0 }),
      field({ text: SERVICE_TIME, fontFamily: "ebGaramond", fontSize: 11, italic: true, align: "left", color: ink, x: 11.9, y: 90.6, w: 50, h: 0 }),
      artwork(art("jamaican-butterfly.svg"), { x: 58, y: 47, w: 42, h: squareH(42) * (100 / 60) }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "allura", ink, muted: GREY_MUTED, accent: green },
  };
}

function lgbt(): ClassicDesign {
  const ink = "#1f1f1f";
  return {
    paper: "#ffffff",
    chrome: () => [frame({ variant: "single", corners: "notched", color: "#333333", x: 6.5, y: 4.2, w: 87, h: 91.6 })],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "pinyonScript", fontSize: 24, color: ink, x: 14, y: 8.8, w: 72, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 22, bold: true, uppercase: true, color: ink, x: 9, y: 14.4, w: 82, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 9, y: 20, w: 82, h: 0 }),
      photo({ border: "single", borderColor: ink, x: 30.2, y: 25.4, w: 39.6, h: 32.4 }),
      fixed({ text: "Service:", fontFamily: "ebGaramond", fontSize: 12, bold: true, color: ink, x: 30, y: 60.2, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 12, bold: true, italic: true, color: ink, x: 20, y: 62.8, w: 60, h: 0 }),
      artwork(art("rainbow-wave.svg"), { x: -3, y: 76, w: 106, h: squareH(106) / (148 / 40) }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#333333" },
  };
}

function guyanaThanksgiving(): ClassicDesign {
  const yellow = "#fcd116";
  const white = "#ffffff";
  const darkType = { heading: "inter", body: "inter", script: "pinyonScript", ink: GREY_INK, muted: GREY_MUTED, accent: "#009e49" } as const;
  return {
    paper: "#009e49",
    chrome: () => [ground(art("guyana-flag.svg"))],
    cover: () => [
      fixed({ text: "A Service Of Thanksgiving", fontFamily: "inter", fontSize: 13, bold: true, color: white, x: 15, y: 5.4, w: 70, h: 0 }),
      fixed({ text: "In Loving Memory Of", fontFamily: "inter", fontSize: 17, bold: true, color: white, x: 12, y: 9.4, w: 76, h: 0 }),
      photo({ border: "double", borderColor: yellow, x: 26.2, y: 16.8, w: 47.6, h: 41.4 }),
      field({ text: "Sunrise: 1st May 1936", fontFamily: "inter", fontSize: 9.5, bold: true, uppercase: true, align: "left", color: yellow, x: 4, y: 62.2, w: 44, h: 0 }),
      field({ text: "Sunset: 12th June 2024", fontFamily: "inter", fontSize: 9.5, bold: true, uppercase: true, align: "right", color: yellow, x: 52, y: 62.2, w: 44, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "inter", fontSize: 26, bold: true, uppercase: true, color: yellow, x: 10, y: 66.6, w: 80, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "inter", fontSize: 11.5, bold: true, uppercase: true, color: white, x: 15, y: 78.4, w: 70, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "inter", fontSize: 10.5, bold: true, uppercase: true, color: white, x: 8, y: 86.2, w: 84, h: 0 }),
    ],
    type: { heading: "inter", body: "inter", script: "pinyonScript", ink: white, muted: white, accent: yellow },
    interior: plainInterior(darkType),
    backTop: 66,
  };
}

function goldenShine(): ClassicDesign {
  const ink = "#2b2015";
  return {
    paper: "#b89a63",
    chrome: () => [ground(art("golden-shine.svg"))],
    cover: () => [
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 25, bold: true, uppercase: true, color: ink, x: 8, y: 5.4, w: 84, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: ink, x: 8, y: 11.6, w: 84, h: 0 }),
      photo({ border: "single", borderColor: "#3b2a18", x: 27.8, y: 17.4, w: 44.4, h: 43.6 }),
      field({ text: `${SERVICE_WHEN_LINE}\n${VENUE_SHORT}`, fontFamily: "ebGaramond", fontSize: 12.5, bold: true, italic: true, color: ink, x: 10, y: 72.4, w: 80, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: "#5a4426" },
  };
}

/* ------------------------------------------------------------------ */
/* Music                                                               */
/* ------------------------------------------------------------------ */

function bobMarley(): ClassicDesign {
  const red = "#d0202a";
  const green = "#2f9a3a";
  const ink = "#2b2b2b";
  return {
    paper: "#f6ec5a",
    chrome: () => [
      ground(art("yellow-shine.svg")),
      shape({ shape: "rect", color: red, strokeWidth: 3, x: 3.2, y: 2.4, w: 93.6, h: 95.2 }),
      shape({ shape: "rect", color: green, strokeWidth: 3, x: 5.4, y: 3.9, w: 89.2, h: 92.2 }),
    ],
    cover: () => [
      fixed({ text: "A Celebration of the life of", fontFamily: "pinyonScript", fontSize: 24, color: ink, x: 12, y: 8.6, w: 76, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 17, bold: true, uppercase: true, color: red, x: 10, y: 15.2, w: 80, h: 0 }),
      field({ text: "'Bob'", fontFamily: "ebGaramond", fontSize: 14, bold: true, color: ink, x: 30, y: 18.8, w: 40, h: 0 }),
      shape({ shape: "rect", color: red, strokeWidth: 2.5, x: 29.8, y: 24.5, w: 40.4, h: 37.2 }),
      photo({ x: 30.6, y: 25.1, w: 38.8, h: 36 }),
      field({ text: DATES_LONG, fontFamily: "ebGaramond", fontSize: 13, bold: true, uppercase: true, color: ink, x: 8, y: 64.8, w: 84, h: 0 }),
      field({ text: SERVICE_DAY, fontFamily: "ebGaramond", fontSize: 12, color: ink, x: 15, y: 73.4, w: 70, h: 0 }),
      field({ text: SERVICE_TIME, fontFamily: "ebGaramond", fontSize: 12, color: ink, x: 30, y: 77.6, w: 40, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 12, bold: true, color: ink, x: 12, y: 82, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: green },
  };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const THEMED_DESIGNS = {
  "celtic-cross": celticCross,
  "grey-cross": greyCross,
  "new-cross": newCross,
  "cross-doves": crossDoves,
  "religious-cross-1": religiousCross1,
  "religious-cross-2": religiousCross2,
  "brown-heart": brownHeart,
  french: () =>
    tricolour({
      outer: "#2f4a9e",
      inner: "#d33a3a",
      name: "#2f4a9e",
      motto: "« Parti mais pas oublié »",
      sunrise: "Lever du soleil : 1er mai 1936\nCoucher du soleil : 12 juin 2024",
      service: "Mardi 16 juin 2026, 11h00\nCrématorium de Reading",
    }),
  italian: () =>
    tricolour({
      outer: "#2f9a3a",
      inner: "#d33a3a",
      name: "#2f9a3a",
      motto: "« Andato ma non dimenticato »",
      sunrise: "Alba: 1 maggio 1936 - Tramonto: 12 giugno 2024",
      service: "Martedì 16 giugno 2026, ore 11.00\nCrematorio di Reading",
    }),
  "jamaican-butterfly": jamaicanButterfly,
  lgbt,
  "guyana-thanksgiving": guyanaThanksgiving,
  "golden-shine": goldenShine,
  "bob-marley": bobMarley,
} satisfies Record<string, (art: ArtworkUrls) => ClassicDesign>;

export type ThemedDesignId = keyof typeof THEMED_DESIGNS;

export const THEMED_DESIGN_IDS = Object.keys(THEMED_DESIGNS) as ThemedDesignId[];

export function buildThemedLayout(id: ThemedDesignId, urls: ArtworkUrls): DesignPage[] {
  const design: (art: ArtworkUrls) => ClassicDesign = THEMED_DESIGNS[id];
  return buildDesignPages(design(urls));
}

export interface ThemedTemplateSpec {
  slug: string;
  name: string;
  design: ThemedDesignId;
  categories: string[];
  /** The stand-in portrait its preview is drawn with, pinned on create. */
  portrait: PlaceholderPortraitId;
  /**
   * Rendered backgrounds the design draws on, so the runner can refuse to
   * build over one `npm run backgrounds:fetch` hasn't rendered yet.
   */
  backgrounds?: Array<[id: string, palette: PaletteId]>;
}

const CURATED_THEMED: Array<
  [name: string, design: ThemedDesignId, categories: string[], portrait: PlaceholderPortraitId]
> = [
  ["Celtic Cross", "celtic-cross", ["religious", "classic"], "portrait-6"],
  ["Grey Cross", "grey-cross", ["religious", "simple"], "portrait-8"],
  ["New Cross", "new-cross", ["religious", "classic"], "portrait-2"],
  ["Cross Doves", "cross-doves", ["religious", "birds", "colourful"], "portrait-7"],
  ["Religious Cross 1", "religious-cross-1", ["religious", "simple"], "portrait-9"],
  ["Religious Cross 2", "religious-cross-2", ["religious", "simple"], "portrait-6"],
  ["Brown Heart", "brown-heart", ["classic", "cultural"], "portrait-1"],
  ["French", "french", ["cultural", "colourful"], "portrait-8"],
  ["Italian", "italian", ["cultural", "colourful"], "portrait-4"],
  ["Jamaican Butterfly", "jamaican-butterfly", ["cultural", "colourful"], "portrait-7"],
  ["LGBT", "lgbt", ["cultural", "colourful"], "portrait-5"],
  ["Guyana Thanksgiving", "guyana-thanksgiving", ["cultural", "colourful"], "portrait-2"],
  ["Golden Shine", "golden-shine", ["classic", "religious"], "portrait-7"],
  ["Bob Marley", "bob-marley", ["music", "cultural", "colourful"], "portrait-7"],
];

export const THEMED_TEMPLATE_SPECS: ThemedTemplateSpec[] = CURATED_THEMED.map(
  ([name, design, categories, portrait]) => ({ slug: slugForName(name), name, design, categories, portrait }),
);
