/**
 * The themed family: the rest of the business's own range — crosses for a
 * religious service, landscapes, sports, music, and covers for a family's
 * heritage — rebuilt the same way as the classic family (classicTemplates.ts),
 * whose builders and placeholder wording these share.
 *
 * Flat, many-coloured artwork (a flag, a rainbow, a sunburst) is drawn as SVG
 * under public/elements/templates/ and placed as a locked image, so it ships
 * with the code and prints as vector; the owner's own cutouts (the Jamaican
 * butterfly) ship there too, as transparent PNGs. Photographs
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
  SERVICE_WHEN_DASH,
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
import {
  ELDER_PORTRAIT_IDS,
  STUDIO_PORTRAIT_GENDER,
  STUDIO_PORTRAIT_IDS,
  type ElderPortraitId,
  type StudioPortraitId,
  type SubjectPortraitId,
} from "@/lib/placeholderPortraits";
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
      // The owner's own butterfly (947 × 838, shadow included). The older
      // jamaican-butterfly.svg stays in public/: saved designs still draw it.
      artwork(art("jamaican-butterfly.png"), { x: 56.5, y: 71.5, w: 38, h: squareH(38) / (947 / 838) }),
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
  const borders = () => [
    shape({ shape: "rect", color: red, strokeWidth: 3, x: 3.2, y: 2.4, w: 93.6, h: 95.2 }),
    shape({ shape: "rect", color: green, strokeWidth: 3, x: 5.4, y: 3.9, w: 89.2, h: 92.2 }),
  ];
  return {
    paper: "#f6ec5a",
    chrome: () => [ground(art("yellow-shine.svg")), ...borders()],
    // The owner's ghosted portrait (bob marley.psd, 884 × 1224), placed as
    // their own cover has it: faint behind the service details, bottom right,
    // the rest hanging off the page — which also takes the PSD's hard right
    // and bottom edges off the sheet. Between the ground and the borders, and
    // on the cover only, so the running order and back page stay plain. The
    // PNG is the PSD knocked back toward the yellow (30%) at 75% of its alpha.
    coverChrome: () => [
      ground(art("yellow-shine.svg")),
      artwork(art("bob-marley.png"), { x: 32, y: 51, w: 95, h: squareH(95) / (884 / 1224) }),
      ...borders(),
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
/* Photographs and candles                                             */
/* ------------------------------------------------------------------ */

/** The drawn candles (candles.svg / blue-candles.svg) in a cover's bottom-right corner. */
const candles = (file: string, x: number, y: number, w: number) =>
  artwork(art(file), { x, y, w, h: squareH(w) / (90 / 136) });

/** A band of colour across the page, bleeding off both edges — Candlelight's years. */
const yearsBand = (color: string, y: number, text: string) => [
  shape({ shape: "rect", color, fill: color, strokeWidth: 1, x: -4, y, w: 108, h: 4.6 }),
  field({ text: "1936", fontFamily: "ebGaramond", fontSize: 16, align: "left", color: text, x: 4, y: y + 0.6, w: 20, h: 0 }),
  field({ text: "2024", fontFamily: "ebGaramond", fontSize: 16, align: "right", color: text, x: 76, y: y + 0.6, w: 20, h: 0 }),
];

function blueCandles(): ClassicDesign {
  const ink = "#3b4a6b";
  return {
    paper: "#4a86c8",
    chrome: () => [ground(art("blue-fade.svg"))],
    cover: () => [
      fixed({ text: "In Loving Memory", fontFamily: "pinyonScript", fontSize: 24, color: ink, x: 20, y: 5.8, w: 60, h: 0 }),
      shape({ shape: "rect", color: "#ffffff", fill: "#ffffff", strokeWidth: 1, x: 23.4, y: 13.4, w: 53.6, h: 42.8 }),
      photo({ x: 25, y: 14.6, w: 50.4, h: 40.4 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 18, uppercase: true, letterSpacing: 0.5, color: "#ffffff", x: 10, y: 58.2, w: 80, h: 0 }),
      field({ text: DATES_LONG, fontFamily: "ebGaramond", fontSize: 11, color: "#ffffff", x: 15, y: 63, w: 70, h: 0 }),
      field({ text: "88 years old", fontFamily: "ebGaramond", fontSize: 11, italic: true, color: "#ffffff", x: 25, y: 65.6, w: 50, h: 0 }),
      ornament({ icon: "latin-cross", color: "#c9a35b", ...aspectBox(46.8, 69.6, 6.4, 20 / 32) }),
      fixed({ text: "Please remember me in your prayers", fontFamily: "ebGaramond", fontSize: 10.5, italic: true, color: "#1d2f55", x: 4, y: 80.2, w: 56, h: 0 }),
      candles("blue-candles.svg", 57, 62, 38),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: "#1d2f55", muted: "#1d2f55", accent: "#ffffff" },
  };
}

function candlelight(): ClassicDesign {
  const ink = "#2b2b2b";
  const maroon = "#6e2a3c";
  return {
    paper: "#cdbfa9",
    chrome: () => [ground(art("candle-shine.svg"))],
    cover: () => [
      fixed({ text: "In Celebration of the life of", fontFamily: "pinyonScript", fontSize: 23, color: ink, x: 10, y: 5.6, w: 80, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 24, bold: true, uppercase: true, color: ink, x: 6, y: 12.6, w: 88, h: 0 }),
      ...yearsBand(maroon, 43.2, "#ffffff"),
      shape({ shape: "rect", color: maroon, fill: maroon, strokeWidth: 1, x: 24.6, y: 23.4, w: 50.8, h: 43.4 }),
      photo({ x: 25.8, y: 24.3, w: 48.4, h: 41.6 }),
      fixed({ text: "Church service led by:", fontFamily: "ebGaramond", fontSize: 10.5, bold: true, align: "left", color: ink, x: 7, y: 70.2, w: 50, h: 0 }),
      field({ text: "Reverend Jane Smith, at", fontFamily: "ebGaramond", fontSize: 10.5, italic: true, align: "left", color: ink, x: 7, y: 72.6, w: 50, h: 0 }),
      field({ text: `${VENUE}\n${SERVICE_TIME}`, fontFamily: "ebGaramond", fontSize: 10.5, italic: true, align: "left", color: ink, x: 7, y: 75, w: 50, h: 0 }),
      fixed({ text: "Burial at:", fontFamily: "ebGaramond", fontSize: 10.5, bold: true, align: "left", color: ink, x: 7, y: 84.6, w: 50, h: 0 }),
      field({ text: "Reading Cemetery, Cemetery Junction\n1.00pm", fontFamily: "ebGaramond", fontSize: 10.5, italic: true, align: "left", color: ink, x: 7, y: 87, w: 54, h: 0 }),
      candles("candles.svg", 63, 63, 35),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: maroon },
  };
}

function goldenShineCandles(): ClassicDesign {
  const ink = "#2b2015";
  const brown = "#4a3520";
  return {
    paper: "#b89a63",
    chrome: () => [ground(art("golden-shine.svg"))],
    cover: () => [
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 24, bold: true, uppercase: true, color: ink, x: 6, y: 13.4, w: 88, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: ink, x: 6, y: 19.6, w: 88, h: 0 }),
      ...yearsBand(brown, 46.4, "#ffffff"),
      shape({ shape: "rect", color: brown, fill: brown, strokeWidth: 1, x: 25.8, y: 24.6, w: 48.4, h: 42 }),
      photo({ x: 27, y: 25.5, w: 46, h: 40.2 }),
      field({ text: `${SERVICE_WHEN_LINE}\n${VENUE_SHORT}`, fontFamily: "ebGaramond", fontSize: 12, bold: true, color: ink, x: 5, y: 69.6, w: 70, h: 0 }),
      candles("candles.svg", 62, 65, 36),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: brown },
  };
}

function doveInTheClouds(urls: ArtworkUrls): ClassicDesign {
  const blue = "#2c5aa0";
  const navy = "#1b2f55";
  return {
    paper: "#cfe2f5",
    chrome: () => [ground(urls.background("sky-rays", "ink"))],
    cover: () => [
      fixed({ text: "In Loving Memory", fontFamily: "marcellus", fontSize: 15, uppercase: true, letterSpacing: 0.5, color: "#ffffff", x: 15, y: 6.2, w: 70, h: 0 }),
      shape({ shape: "rect", color: "#ffffff", fill: "#ffffff", strokeWidth: 1, x: 28.6, y: 12.4, w: 42.8, h: 35.8 }),
      photo({ x: 29.4, y: 13, w: 41.2, h: 34.6 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 19, uppercase: true, color: "#ffffff", x: 8, y: 50.8, w: 84, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: navy, x: 8, y: 55.6, w: 84, h: 0 }),
      // The owner's dove (dove.psd, 572 × 682), in place of the drawn ornament.
      artwork(art("dove.png"), { x: 39.3, y: 59.4, w: 21.4, h: squareH(21.4) / (572 / 682) }),
      fixed({ text: "Service:", fontFamily: "marcellus", fontSize: 12, bold: true, uppercase: true, color: navy, x: 30, y: 78.6, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: navy, x: 20, y: 81, w: 60, h: 0 }),
      fixed({ text: "Venue:", fontFamily: "marcellus", fontSize: 12, bold: true, uppercase: true, color: navy, x: 30, y: 87.6, w: 40, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: navy, x: 12, y: 90, w: 76, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: navy, muted: navy, accent: blue },
    interior: plainInterior({ heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: navy, muted: navy, accent: blue }),
  };
}

function religiousCrossSunlight(urls: ArtworkUrls): ClassicDesign {
  const white = "#ffffff";
  const navy = "#1b2f55";
  return {
    paper: "#b9d3ee",
    // The owner's cut-out cross (Religious Cross Sunlight PSD, 440 × 844) on
    // a plain sky: the post a quarter of the way in, the crossbar behind the
    // portrait, the foot off the bottom edge. cross-sky stays for saved designs.
    chrome: () => [
      ground(urls.background("cross-sunlight-sky", "ink")),
      artwork(art("cross-sunlight.png"), { x: -8.7, y: 16, w: 63.6, h: squareH(63.6) / (440 / 844) }),
    ],
    cover: () => [
      fixed({ text: "Celebrating The Life Of", fontFamily: "pinyonScript", fontSize: 22, color: white, x: 15, y: 6.2, w: 70, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 26, uppercase: true, color: white, x: 6, y: 11.2, w: 88, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: navy, x: 8, y: 18.4, w: 84, h: 0 }),
      photo({ border: "single", borderColor: white, x: 35, y: 24.4, w: 41.6, h: 35.4 }),
      fixed({ text: "Funeral Service:", fontFamily: "ebGaramond", fontSize: 12.5, bold: true, italic: true, color: navy, x: 32, y: 66.2, w: 56, h: 0 }),
      field({ text: `${SERVICE_WHEN_LINE}\n${VENUE_TWO_LINES}`, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: navy, x: 30, y: 69, w: 60, h: 0 }),
      fixed({ text: "Committal:", fontFamily: "ebGaramond", fontSize: 12, bold: true, italic: true, color: navy, x: 32, y: 78.6, w: 56, h: 0 }),
      field({ text: "Reading Crematorium, 1.00pm", fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: navy, x: 30, y: 81.2, w: 60, h: 0 }),
      fixed({ text: "Reception:", fontFamily: "ebGaramond", fontSize: 12, bold: true, italic: true, color: navy, x: 32, y: 85.6, w: 56, h: 0 }),
      field({ text: "The Crown, High Street, Reading", fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: navy, x: 30, y: 88.2, w: 60, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: navy, muted: navy, accent: "#2c5aa0" },
    interior: plainInterior({ heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: navy, muted: navy, accent: "#2c5aa0" }),
  };
}

function goldenSunset(art: ArtworkUrls): ClassicDesign {
  const white = "#ffffff";
  const cream = "#f6e6cf";
  return {
    paper: "#2a0d0b",
    chrome: () => [ground(art.background("lake-sunset-ember", "ember"))],
    cover: () => [
      fixed({ text: "Funeral Service\nand celebration of the life of", fontFamily: "ebGaramond", fontSize: 15, italic: true, color: cream, x: 10, y: 6.4, w: 80, h: 0 }),
      shape({ shape: "rect", color: white, fill: white, strokeWidth: 1, x: 28.6, y: 18, w: 42.8, h: 39 }),
      photo({ x: 29.6, y: 18.8, w: 40.8, h: 37.4 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 19, bold: true, uppercase: true, color: white, x: 8, y: 59.2, w: 84, h: 0 }),
      field({ text: DATES_LONG, fontFamily: "ebGaramond", fontSize: 11, color: cream, x: 15, y: 64, w: 70, h: 0 }),
      field({ text: `${CHURCH}\n${SERVICE_DAY}\n${SERVICE_TIME}`, fontFamily: "ebGaramond", fontSize: 11, bold: true, italic: true, color: cream, x: 15, y: 69.6, w: 70, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink: white, muted: cream, accent: "#d9822b" },
    interior: plainInterior({ heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink: GREY_INK, muted: GREY_MUTED, accent: "#7a1f2e" }),
  };
}

function grandPiano(art: ArtworkUrls): ClassicDesign {
  const gold = "#c9a35b";
  const white = "#ffffff";
  return {
    paper: "#000000",
    chrome: () => [
      // The owner's photograph; piano-keys stays for saved designs.
      ground(art.background("piano-hands", "noir")),
      frame({ variant: "single", corners: "notched", color: gold, x: 4.6, y: 3, w: 90.8, h: 94 }),
    ],
    cover: () => [
      fixed({ text: "Celebrating the life of", fontFamily: "pinyonScript", fontSize: 23, color: white, x: 15, y: 6.4, w: 70, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 24, bold: true, uppercase: true, color: white, x: 7, y: 11.6, w: 86, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: white, x: 8, y: 17.6, w: 84, h: 0 }),
      photo({ border: "double", borderColor: gold, x: 30.4, y: 22.4, w: 39.2, h: 33.8 }),
      fixed({ text: "Service:", fontFamily: "marcellus", fontSize: 11.5, uppercase: true, color: white, x: 30, y: 58.4, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 11, color: white, x: 20, y: 60.8, w: 60, h: 0 }),
      fixed({ text: "Venue:", fontFamily: "marcellus", fontSize: 11.5, uppercase: true, color: white, x: 30, y: 67.2, w: 40, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: white, x: 12, y: 69.6, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink: white, muted: white, accent: gold },
    interior: {
      type: { paper: "#ffffff", heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink: GREY_INK, muted: GREY_MUTED, accent: gold },
      chrome: () => [frame({ variant: "single", corners: "notched", color: gold, x: 4.6, y: 3, w: 90.8, h: 94 })],
    },
    backTop: 30,
  };
}

/** The music and bookworm covers: script, name, Sunrise/Sunset, framed portrait, the service. */
function musicCover(ink: string, photoBorder: "single" | "double"): CanvasElement[] {
  return [
    fixed({ text: "Celebrating the life of", fontFamily: "pinyonScript", fontSize: 23, color: ink, x: 15, y: 6.6, w: 70, h: 0 }),
    field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 24, bold: true, uppercase: true, color: ink, x: 7, y: 12.2, w: 86, h: 0 }),
    field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: ink, x: 8, y: 18.2, w: 84, h: 0 }),
    photo({ border: photoBorder, borderColor: "#333333", x: 29.6, y: 23.4, w: 40.8, h: 32.4 }),
  ];
}

function guitar(art: ArtworkUrls): ClassicDesign {
  const ink = GREY_INK;
  return {
    paper: "#ffffff",
    chrome: () => [],
    cover: () => [
      ...musicCover(ink, "single"),
      fixed({ text: "Service:", fontFamily: "marcellus", fontSize: 11.5, uppercase: true, color: ink, x: 30, y: 58.6, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 20, y: 61, w: 60, h: 0 }),
      fixed({ text: "Venue:", fontFamily: "marcellus", fontSize: 11.5, uppercase: true, color: ink, x: 30, y: 67.6, w: 40, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 12, y: 70, w: 76, h: 0 }),
      // The owner's guitar (cut out at 1510 × 644), below the venue lines;
      // museum-guitar stays for saved designs.
      artwork(art.spray("owner-guitar"), { x: 8, y: 75, w: 84, h: squareH(84) / (1510 / 644) }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#b98a4e" },
  };
}

function melody(art: ArtworkUrls): ClassicDesign {
  const ink = GREY_INK;
  return {
    paper: "#ffffff",
    // The owner's photograph; sheet-music stays for saved designs.
    chrome: () => [ground(art.background("melody-score", "ink"))],
    cover: () => [
      ...musicCover(ink, "double"),
      field({ text: "“Forever in our hearts, and in every song”", fontFamily: "ebGaramond", fontSize: 11, italic: true, color: "#7a1f2e", x: 8, y: 58.6, w: 84, h: 0 }),
      fixed({ text: "Service:", fontFamily: "marcellus", fontSize: 11.5, uppercase: true, color: ink, x: 30, y: 63, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 20, y: 65.4, w: 60, h: 0 }),
      fixed({ text: "Venue:", fontFamily: "marcellus", fontSize: 11.5, uppercase: true, color: ink, x: 30, y: 72, w: 40, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 12, y: 74.4, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#7a1f2e" },
    interior: plainInterior({ heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#7a1f2e" }),
  };
}

function bookworm(art: ArtworkUrls): ClassicDesign {
  const ink = GREY_INK;
  return {
    paper: "#ffffff",
    chrome: () => [],
    cover: () => [
      fixed({ text: "In loving memory of", fontFamily: "pinyonScript", fontSize: 26, color: "#444444", x: 15, y: 7.8, w: 70, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 19, bold: true, uppercase: true, color: ink, x: 8, y: 14.6, w: 84, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: ink, x: 8, y: 19.6, w: 84, h: 0 }),
      photo({ border: "single", borderColor: "#999999", x: 30.2, y: 24.8, w: 39.6, h: 42.6 }),
      artwork(art.spray("old-books"), { x: 14, y: 69, w: 72, h: 30 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#8a8a8a" },
  };
}

/**
 * A martial-arts silhouette behind the portrait, inside a fine double rule.
 * `aspect` is the silhouette's width over height.
 */
function martialArts(paper: string, silhouette: string, aspect: number, box: { x: number; y: number; w: number }): ClassicDesign {
  const ink = GREY_INK;
  const rule = "#a9b0bb";
  return {
    paper,
    chrome: () => [
      shape({ shape: "rect", color: rule, strokeWidth: 2, x: 3.6, y: 2.6, w: 92.8, h: 94.8 }),
      frame({ variant: "single", color: rule, x: 5, y: 3.6, w: 90, h: 92.8 }),
    ],
    cover: () => [
      artwork(art(silhouette), { ...box, h: squareH(box.w) / aspect }),
      fixed({ text: "Celebrating the life of", fontFamily: "marcellus", fontSize: 12, uppercase: true, color: "#555555", x: 15, y: 7.8, w: 70, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 21, bold: true, uppercase: true, color: ink, x: 8, y: 11.4, w: 84, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: ink, x: 8, y: 16.8, w: 84, h: 0 }),
      photo({ border: "single", borderColor: "#888888", x: 30, y: 22.4, w: 38.4, h: 36.8 }),
      fixed({ text: "Service:", fontFamily: "ebGaramond", fontSize: 11.5, bold: true, color: ink, x: 30, y: 62.6, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 20, y: 65, w: 60, h: 0 }),
      fixed({ text: "Venue:", fontFamily: "ebGaramond", fontSize: 11.5, bold: true, color: ink, x: 30, y: 72, w: 40, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 12, y: 74.4, w: 76, h: 0 }),
      fixed({ text: "Officiating Minister:", fontFamily: "ebGaramond", fontSize: 11.5, bold: true, color: ink, x: 25, y: 81.6, w: 50, h: 0 }),
      field({ text: "Reverend Jane Smith", fontFamily: "ebGaramond", fontSize: 11, bold: true, italic: true, color: ink, x: 20, y: 84, w: 60, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: rule },
  };
}

/* ------------------------------------------------------------------ */
/* Landscapes and sport                                                */
/* ------------------------------------------------------------------ */

/** A drawn sports piece (public/elements/templates) at its own proportions. */
const kit = (file: string, aspect: number, x: number, y: number, w: number) =>
  artwork(art(file), { x, y, w, h: squareH(w) / aspect });

function fields(art: ArtworkUrls): ClassicDesign {
  const navy = "#24408e";
  const ink = "#1f2a44";
  return {
    paper: "#e6ece2",
    chrome: () => [
      ground(art.background("meadow-wash", "ink")),
      shape({ shape: "rect", color: navy, strokeWidth: 2.5, x: 3.2, y: 2.4, w: 93.6, h: 95.2 }),
    ],
    cover: () => [
      fixed({ text: "A Celebration of the Life of", fontFamily: "ebGaramond", fontSize: 13, color: ink, x: 15, y: 7.2, w: 70, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 22, bold: true, uppercase: true, color: navy, x: 6, y: 11.2, w: 88, h: 0 }),
      field({ text: DATES_LONG, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: ink, x: 15, y: 19.4, w: 70, h: 0 }),
      shape({ shape: "rect", color: "#111111", strokeWidth: 4, x: 26.4, y: 24, w: 47.2, h: 47 }),
      photo({ border: "single", borderColor: "#ffffff", x: 27.6, y: 24.9, w: 44.8, h: 45.2 }),
      fixed({ text: "Funeral Mass", fontFamily: "ebGaramond", fontSize: 15, bold: true, color: navy, x: 25, y: 75.2, w: 50, h: 0 }),
      field({ text: SERVICE_WHEN_DASH, fontFamily: "ebGaramond", fontSize: 11.5, bold: true, color: ink, x: 12, y: 81.2, w: 76, h: 0 }),
      field({ text: VENUE_LINE, fontFamily: "ebGaramond", fontSize: 11, color: ink, x: 8, y: 86.6, w: 84, h: 0 }),
      field({ text: PLACEHOLDER_OFFICIANT, fontFamily: "ebGaramond", fontSize: 11, bold: true, italic: true, color: ink, x: 12, y: 89.2, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: navy },
    interior: plainInterior({ heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: navy }),
  };
}

function mountainWaterfall(art: ArtworkUrls): ClassicDesign {
  const ink = "#1f2a44";
  return {
    paper: "#93a8dc",
    chrome: () => [ground(art.background("waterfall-band", "periwinkle"))],
    cover: () => [
      fixed({ text: "Memorial & Thanksgiving Service For", fontFamily: "pinyonScript", fontSize: 18, color: ink, x: 10, y: 5.8, w: 80, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "pinyonScript", fontSize: 28, color: ink, x: 10, y: 9.4, w: 80, h: 0 }),
      shape({ shape: "rect", color: "#2b2b2b", fill: "#ffffff", strokeWidth: 1, x: 29.6, y: 15.8, w: 42.4, h: 36.2 }),
      photo({ x: 30.6, y: 16.6, w: 40.4, h: 34.6 }),
      field({ text: DATES_LONG, fontFamily: "pinyonScript", fontSize: 18, color: ink, x: 10, y: 53, w: 80, h: 0 }),
      field({ text: "Forever loved, forever missed,\nalways in our hearts.", fontFamily: "ebGaramond", fontSize: 11, italic: true, color: ink, x: 12, y: 57.8, w: 76, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: ink, x: 12, y: 63, w: 76, h: 0 }),
      field({ text: SERVICE_WHEN_LINE, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: ink, x: 12, y: 68.4, w: 76, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: "#2f5597" },
    interior: plainInterior({ heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: "#2f5597" }),
    backTop: 22,
  };
}

function redSunset(art: ArtworkUrls): ClassicDesign {
  const grey = "#6a6a6a";
  return {
    paper: "#ffffff",
    chrome: () => [ground(art.background("red-sunset-band", "wine"))],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "inter", fontSize: 13, italic: true, color: "#8a8a8a", x: 15, y: 12.6, w: 70, h: 0 }),
      field({ text: "a very special wife and friend", fontFamily: "inter", fontSize: 11.5, italic: true, color: "#8a8a8a", x: 12, y: 15.6, w: 76, h: 0 }),
      photo({ shape: "oval", border: "single", borderColor: "#b5b5b5", x: 30.4, y: 21, w: 39.2, h: 32.4 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "inter", fontSize: 23, bold: true, color: "#555555", x: 8, y: 56.8, w: 84, h: 0 }),
      field({ text: DATES_LONG, fontFamily: "inter", fontSize: 13, italic: true, color: grey, x: 12, y: 62, w: 76, h: 0 }),
      field({ text: `${VENUE_SHORT}\n${SERVICE_WHEN_LINE}`, fontFamily: "inter", fontSize: 11, color: "#8a8a8a", x: 10, y: 68.6, w: 80, h: 0 }),
    ],
    type: { heading: "inter", body: "inter", script: "pinyonScript", ink: "#555555", muted: grey, accent: "#a3325f" },
    backTop: 30,
  };
}

/** The sports covers' shared head: an overline, the name, Sunrise/Sunset. */
const sportHead = (overline: CanvasElement, ink: string, nameSize = 21) => [
  overline,
  field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: nameSize, bold: true, uppercase: true, color: ink, x: 6, y: 11.8, w: 88, h: 0 }),
  field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 10.5, bold: true, color: ink, x: 8, y: 17.4, w: 84, h: 0 }),
];

/** "SERVICE:" / "VENUE:" blocks, centred or set left. */
function serviceBlocks(ink: string, top: number, align: "center" | "left" = "center"): CanvasElement[] {
  const x = align === "left" ? 7 : 12;
  const w = align === "left" ? 46 : 76;
  return [
    fixed({ text: "Service:", fontFamily: "marcellus", fontSize: 12, bold: true, uppercase: true, align, color: ink, x, y: top, w, h: 0 }),
    field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 11.5, bold: true, align, color: ink, x, y: top + 2.6, w, h: 0 }),
    fixed({ text: "Venue:", fontFamily: "marcellus", fontSize: 12, bold: true, uppercase: true, align, color: ink, x, y: top + 9.8, w, h: 0 }),
    field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 11.5, bold: true, align, color: ink, x, y: top + 12.4, w, h: 0 }),
  ];
}

function basketball(art: ArtworkUrls): ClassicDesign {
  const ink = GREY_INK;
  const border = () => frame({ variant: "single", corners: "notched", color: "#bdbdbd", x: 3.4, y: 2.4, w: 93.2, h: 95.2 });
  return {
    paper: "#ffffff",
    chrome: () => [border()],
    // The owner's hoop and ball (basketball-page) on the cover alone, under
    // the border; basketball-hoop.svg and basketball.svg stay for saved designs.
    coverChrome: () => [ground(art.background("basketball-page", "ink")), border()],
    cover: () => [
      ...sportHead(fixed({ text: "Celebrating the life of", fontFamily: "marcellus", fontSize: 12, uppercase: true, color: "#555555", x: 15, y: 7.8, w: 70, h: 0 }), ink, 22),
      photo({ border: "single", borderColor: "#333333", x: 29.4, y: 22, w: 39.6, h: 33.2 }),
      ...serviceBlocks(ink, 76.6, "left"),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#e06f1f" },
  };
}

function cricket(art: ArtworkUrls): ClassicDesign {
  const red = "#b8322a";
  const ink = GREY_INK;
  return {
    paper: "#ffffff",
    // The owner's grass and ball; grass-band and cricket-ball.svg stay for saved designs.
    chrome: () => [ground(art.background("cricket-page", "ink"))],
    cover: () => [
      fixed({ text: "In Loving Memory Of", fontFamily: "pinyonScript", fontSize: 25, color: ink, x: 15, y: 5.6, w: 70, h: 0 }),
      photo({ x: 25, y: 12, w: 50, h: 45 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 18, uppercase: true, color: red, x: 8, y: 57.8, w: 84, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 11, bold: true, color: ink, x: 6, y: 62.8, w: 88, h: 0 }),
      field({ text: VENUE, fontFamily: "ebGaramond", fontSize: 10.5, color: ink, x: 20, y: 66.6, w: 60, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 10.5, color: ink, x: 20, y: 74.2, w: 60, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: red },
  };
}

function football(art: ArtworkUrls): ClassicDesign {
  const ink = "#3a3a3a";
  return {
    paper: "#ffffff",
    // The owner's grass and ball; grass-band and football.svg stay for saved designs.
    chrome: () => [ground(art.background("football-page", "ink"))],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "pinyonScript", fontSize: 28, color: ink, x: 12, y: 13.6, w: 76, h: 0 }),
      photo({ shape: "oval", border: "single", borderColor: "#c9c9c9", x: 33.8, y: 22, w: 32.4, h: 30 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "pinyonScript", fontSize: 38, color: ink, x: 6, y: 55, w: 88, h: 0 }),
      field({ text: DATES_LONG, fontFamily: "pinyonScript", fontSize: 22, color: ink, x: 8, y: 62.6, w: 84, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#3f8f2f" },
    backTop: 30,
  };
}

function golf(art: ArtworkUrls): ClassicDesign {
  const ink = "#1f2a44";
  return {
    paper: "#cfe2f5",
    // The owner's sky, grass and tee; sky-clouds, turf.svg and
    // golf-ball-tee.svg stay for saved designs.
    chrome: () => [ground(art.background("golf-page", "ink"))],
    cover: () => [
      ...sportHead(fixed({ text: "In Loving Memory of", fontFamily: "pinyonScript", fontSize: 24, color: ink, x: 15, y: 5.8, w: 70, h: 0 }), ink, 20),
      shape({ shape: "rect", color: "#ffffff", fill: "#ffffff", strokeWidth: 1, x: 30.8, y: 23.2, w: 36.8, h: 31.6 }),
      photo({ x: 31.6, y: 23.9, w: 35.2, h: 30.2 }),
      kit("golf-flag.svg", 16 / 44, 21, 50, 8),
      ...serviceBlocks(ink, 57.8),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: "#3f8f2f" },
    interior: plainInterior({ heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#3f8f2f" }),
  };
}

function rugby(art: ArtworkUrls): ClassicDesign {
  const ink = "#1f2a44";
  return {
    paper: "#cfe2f5",
    // The owner's sky, grass and ball; sky-clouds, turf.svg and
    // rugby-ball.svg stay for saved designs.
    chrome: () => [ground(art.background("rugby-page", "ink"))],
    cover: () => [
      ...sportHead(fixed({ text: "Celebrating the life of", fontFamily: "marcellus", fontSize: 12, uppercase: true, color: ink, x: 15, y: 7.4, w: 70, h: 0 }), ink),
      shape({ shape: "rect", color: "#ffffff", fill: "#ffffff", strokeWidth: 1, x: 30, y: 21.4, w: 39.2, h: 34.2 }),
      photo({ x: 30.8, y: 22.1, w: 37.6, h: 32.8 }),
      ...serviceBlocks(ink, 58.2),
      fixed({ text: "Officiating Minister:", fontFamily: "marcellus", fontSize: 11, uppercase: true, color: ink, x: 15, y: 77.6, w: 70, h: 0 }),
      field({ text: "Reverend Jane Smith", fontFamily: "ebGaramond", fontSize: 10.5, bold: true, italic: true, color: ink, x: 20, y: 80, w: 60, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: "#3f8f2f" },
    interior: plainInterior({ heading: "ebGaramond", body: "ebGaramond", script: "pinyonScript", ink, muted: GREY_MUTED, accent: "#3f8f2f" }),
  };
}

/* ------------------------------------------------------------------ */
/* Child and pets                                                      */
/* ------------------------------------------------------------------ */

/** A baby's or child's dates: a short life, set out as the cover prints it. */
export const CHILD_SUNRISE_SUNSET = "Sunrise: 17th April 2023 - Sunset: 5th October 2024";
/** A pet's years. */
export const PET_YEARS = "2012 - 2024";

function rainbowSky(): ClassicDesign {
  const blue = "#5aa8e0";
  return {
    paper: "#ffffff",
    chrome: () => [ground(art("rainbow-sky.svg"))],
    cover: () => [
      fixed({ text: "In Loving Memory", fontFamily: "merriweather", fontSize: 16.5, bold: true, color: blue, x: 15, y: 8.2, w: 70, h: 0 }),
      photo({ x: 30, y: 16.6, w: 40, h: 36.4 }),
      shape({ shape: "rect", color: "#7cb9e8", strokeWidth: 2.5, x: 30, y: 16.6, w: 40, h: 36.4 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "merriweather", fontSize: 22, bold: true, uppercase: true, color: blue, x: 4, y: 55.6, w: 92, h: 0 }),
      field({ text: CHILD_SUNRISE_SUNSET, fontFamily: "lato", fontSize: 11.5, bold: true, color: blue, x: 4, y: 62.4, w: 92, h: 0 }),
      artwork(art("abc-blocks.svg"), { x: 40, y: 68.4, w: 20, h: squareH(20) }),
    ],
    type: { heading: "merriweather", body: "lato", script: "courgette", ink: "#3d7fb8", muted: "#4f6a85", accent: "#7cb9e8" },
  };
}

/** A pet's portrait large on a pastel card, "In Loving Memory of", the name and years. */
function petCard(ground: string, paws?: string): ClassicDesign {
  const ink = "#1f1f1f";
  const paw = (x: number, y: number, w: number, rotation: number) =>
    ornament({ icon: "paw-print", color: paws ?? ground, rotation, x, y, w, h: squareH(w) });
  return {
    paper: "#ffffff",
    chrome: () => [
      shape({ shape: "rect", color: ground, fill: ground, strokeWidth: 1, x: 4, y: 3, w: 92, h: 94 }),
      frame({ variant: "single", color: "#ffffff", x: 5.4, y: 4, w: 89.2, h: 92 }),
      ...(paws ? [paw(8, 74, 7, -20), paw(15, 82, 6, -10), paw(84, 74, 7, 20), paw(77, 82, 6, 10)] : []),
    ],
    cover: () => [
      photo({ border: "single", borderColor: "#ffffff", x: 18.3, y: 9, w: 62.3, h: 61.5 }),
      fixed({ text: "In Loving Memory of", fontFamily: "courgette", fontSize: 19, color: ink, x: 12, y: 71.8, w: 76, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "quicksand", fontSize: 40, bold: true, uppercase: true, color: ink, x: 6, y: 76, w: 88, h: 0 }),
      field({ text: PET_YEARS, fontFamily: "quicksand", fontSize: 19, color: ink, x: 20, y: 85.6, w: 60, h: 0 }),
    ],
    type: { heading: "quicksand", body: "quicksand", script: "courgette", ink, muted: "#4a4a4a", accent: "#7aa9c4" },
  };
}

function whiteRabbits(): ClassicDesign {
  const ink = "#1f1f1f";
  return {
    paper: "#c6e6f7",
    chrome: () => [],
    cover: () => [
      shape({ shape: "rect", color: "#ffffff", fill: "#ffffff", strokeWidth: 1, x: 23.4, y: 6.6, w: 53.6, h: 49 }),
      photo({ x: 24.5, y: 7.6, w: 51.4, h: 47 }),
      fixed({ text: "In Loving Memory of", fontFamily: "courgette", fontSize: 18, color: ink, x: 12, y: 56.4, w: 76, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "quicksand", fontSize: 38, bold: true, uppercase: true, color: ink, x: 6, y: 60.4, w: 88, h: 0 }),
      field({ text: PET_YEARS, fontFamily: "quicksand", fontSize: 18, color: ink, x: 20, y: 69.6, w: 60, h: 0 }),
      artwork(art("bunny.svg"), { x: 0, y: 66, w: 30, h: squareH(30) / 0.6 }),
      artwork(art("bunny-left.svg"), { x: 70, y: 66, w: 30, h: squareH(30) / 0.6 }),
    ],
    type: { heading: "quicksand", body: "quicksand", script: "courgette", ink, muted: "#4a4a4a", accent: "#7aa9c4" },
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
  "blue-candles": blueCandles,
  candlelight,
  "golden-shine-candles": goldenShineCandles,
  "dove-in-the-clouds": doveInTheClouds,
  "religious-cross-sunlight": religiousCrossSunlight,
  "golden-sunset": goldenSunset,
  "grand-piano": grandPiano,
  guitar,
  melody,
  bookworm,
  // The owner's silhouettes (karate grey.tif, kickboxer.tif) in the drawn
  // ones' grey, a little taller; karate-silhouette(-left).svg stay for
  // saved designs.
  "karate-grey": () => martialArts("#eef1f6", "karate-grey.png", 934 / 1400, { x: 2, y: 11, w: 66 }),
  fields,
  "mountain-waterfall": mountainWaterfall,
  "red-sunset": redSunset,
  basketball,
  cricket,
  football,
  golf,
  rugby,
  "rainbow-sky": rainbowSky,
  "rabbit-blue": () => petCard("#c6e6f7"),
  "white-rabbits": whiteRabbits,
  "paw-prints-green": () => petCard("#dcefd8", "#9cc58e"),
  "paw-prints-lilac": () => petCard("#e6def4", "#b3a3d6"),
  "kickboxer-yellow": () => martialArts("#f3f2e3", "kickboxer.png", 1028 / 1400, { x: 22, y: 11, w: 73 }),
} satisfies Record<string, (art: ArtworkUrls) => ClassicDesign>;

export type ThemedDesignId = keyof typeof THEMED_DESIGNS;

export const THEMED_DESIGN_IDS = Object.keys(THEMED_DESIGNS) as ThemedDesignId[];

/** The sample person a template is shown as: who the preview's portrait is. */
export interface Person {
  name: string;
  nickname: string;
  /** Unset for a pet; the wording that would need one isn't on a pet's cover. */
  gender?: "woman" | "man";
}

const person = (portrait: StudioPortraitId, name: string, nickname: string): Person => ({
  name,
  nickname,
  gender: STUDIO_PORTRAIT_GENDER[portrait],
});

/** One sample person per studio portrait, named to match it. */
export const STUDIO_PEOPLE: Record<StudioPortraitId, Person> = {
  "portrait-10": person("portrait-10", "Grace Ellis", "Gracie"),
  "portrait-11": person("portrait-11", "Daniel Clarke", "Danny"),
  "portrait-12": person("portrait-12", "Susan Hughes", "Sue"),
  "portrait-13": person("portrait-13", "Robert Bayne", "Bob"),
  "portrait-14": person("portrait-14", "Sarah Ward", "Sally"),
  "portrait-15": person("portrait-15", "Michael Morris", "Mike"),
  "portrait-16": person("portrait-16", "Emily Turner", "Em"),
  "portrait-17": person("portrait-17", "Thomas Reid", "Tom"),
  "portrait-18": person("portrait-18", "Margaret Bayne", "Peggy"),
  "portrait-19": person("portrait-19", "James Carter", "Jamie"),
  "portrait-20": person("portrait-20", "Rebecca Lewis", "Becky"),
  "portrait-21": person("portrait-21", "Peter Walsh", "Pete"),
};

/** The baby and the pets the subject portraits show. */
export const SUBJECT_PEOPLE: Record<SubjectPortraitId, Person> = {
  "portrait-22": { name: "Oliver Hughes", nickname: "Ollie", gender: "man" },
  "portrait-23": { name: "Bramble", nickname: "Bramble" },
  "portrait-24": { name: "Snowy", nickname: "Snowy" },
  "portrait-25": { name: "Buddy", nickname: "Buddy" },
  "portrait-26": { name: "Misty", nickname: "Misty" },
};

/**
 * The older studio portraits are the same twelve people aged, in the same
 * order, so each is shown as its younger twin — same name, same wording.
 */
export const ELDER_PEOPLE = Object.fromEntries(
  ELDER_PORTRAIT_IDS.map((id, index) => [id, STUDIO_PEOPLE[STUDIO_PORTRAIT_IDS[index]]]),
) as Record<ElderPortraitId, Person>;

/** A stand-in a themed template can be pinned to. */
export type ThemedPortraitId = StudioPortraitId | ElderPortraitId | SubjectPortraitId;

/** Who each pinnable stand-in shows. */
const PEOPLE: Record<ThemedPortraitId, Person> = { ...STUDIO_PEOPLE, ...ELDER_PEOPLE, ...SUBJECT_PEOPLE };

/**
 * The designs' sample wording that names or genders the person, and what it
 * becomes for someone else. The designs are written for Robert Bayne ("Bob");
 * personalise() rewrites them for the template's own portrait.
 */
const PERSONAL_TEXT: Record<string, (p: Person) => string> = {
  [PLACEHOLDER_NAME]: (p) => p.name,
  "(fondly known as Bob)": (p) => `(fondly known as ${p.nickname})`,
  "(Known as Bob)": (p) => `(Known as ${p.nickname})`,
  "'Bob'": (p) => `'${p.nickname}'`,
  "a very special wife and friend": (p) => `a very special ${p.gender === "woman" ? "wife" : "husband"} and friend`,
};

/** The pages with the sample person's name and wording rewritten for `who`. */
export function personalise(pages: DesignPage[], who: Person): DesignPage[] {
  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) =>
      element.type === "text" && element.text in PERSONAL_TEXT
        ? { ...element, text: PERSONAL_TEXT[element.text](who) }
        : element,
    ),
  }));
}

export function buildThemedLayout(id: ThemedDesignId, urls: ArtworkUrls, who?: Person): DesignPage[] {
  const design: (art: ArtworkUrls) => ClassicDesign = THEMED_DESIGNS[id];
  const pages = buildDesignPages(design(urls));
  return who ? personalise(pages, who) : pages;
}

export interface ThemedTemplateSpec {
  slug: string;
  name: string;
  design: ThemedDesignId;
  categories: string[];
  /**
   * The stand-in portrait its preview is drawn with, pinned on create: the
   * older studio face where the theme reads as a long life (faith, heritage,
   * the quieter pastimes), the younger one where it reads young (most sport).
   */
  portrait: ThemedPortraitId;
  /** Who the template is shown as — named and worded to match the portrait. */
  person: Person;
  /**
   * Rendered backgrounds the design draws on, so the runner can refuse to
   * build over one `npm run backgrounds:fetch` hasn't rendered yet.
   */
  backgrounds?: Array<[id: string, palette: PaletteId]>;
}

const CURATED_THEMED: Array<
  [
    name: string,
    design: ThemedDesignId,
    categories: string[],
    portrait: ThemedPortraitId,
    backgrounds?: Array<[id: string, palette: PaletteId]>,
  ]
> = [
  ["Celtic Cross", "celtic-cross", ["religious", "classic"], "portrait-38"],
  ["Grey Cross", "grey-cross", ["religious", "simple"], "portrait-32"],
  ["New Cross", "new-cross", ["religious", "classic"], "portrait-34"],
  ["Cross Doves", "cross-doves", ["religious", "birds", "colourful"], "portrait-35"],
  ["Religious Cross 1", "religious-cross-1", ["religious", "simple"], "portrait-33"],
  ["Religious Cross 2", "religious-cross-2", ["religious", "simple"], "portrait-27"],
  ["Brown Heart", "brown-heart", ["classic", "cultural"], "portrait-38"],
  ["French", "french", ["cultural", "colourful"], "portrait-36"],
  ["Italian", "italian", ["cultural", "colourful"], "portrait-30"],
  ["Jamaican Butterfly", "jamaican-butterfly", ["cultural", "colourful"], "portrait-32"],
  ["LGBT", "lgbt", ["cultural", "colourful"], "portrait-17"],
  ["Guyana Thanksgiving", "guyana-thanksgiving", ["cultural", "colourful"], "portrait-31"],
  ["Golden Shine", "golden-shine", ["classic", "religious"], "portrait-33"],
  ["Bob Marley", "bob-marley", ["music", "cultural", "colourful"], "portrait-11"],
  ["Blue Candles", "blue-candles", ["religious", "calm"], "portrait-28", []],
  ["Candlelight", "candlelight", ["religious", "classic"], "portrait-30", []],
  ["Golden Shine Candles", "golden-shine-candles", ["religious", "classic"], "portrait-27", []],
  ["Dove in the Clouds", "dove-in-the-clouds", ["religious", "birds", "calm"], "portrait-29", [["sky-rays", "ink"]]],
  ["Religious Cross Sunlight", "religious-cross-sunlight", ["religious", "calm"], "portrait-36", [["cross-sunlight-sky", "ink"]]],
  ["Golden Sunset", "golden-sunset", ["nature", "calm"], "portrait-28", [["lake-sunset-ember", "ember"]]],
  ["Grand Piano", "grand-piano", ["music", "classic"], "portrait-38", [["piano-hands", "noir"]]],
  ["Guitar", "guitar", ["music", "simple"], "portrait-12", []],
  ["Melody", "melody", ["music", "calm"], "portrait-17", [["melody-score", "ink"]]],
  ["Bookworm", "bookworm", ["sport", "simple"], "portrait-28", []],
  ["Karate Grey", "karate-grey", ["sport", "modern"], "portrait-12", []],
  ["Kickboxer Yellow", "kickboxer-yellow", ["sport", "modern"], "portrait-15", []],
  ["Fields", "fields", ["nature", "calm"], "portrait-20", [["meadow-wash", "ink"]]],
  ["Mountain Waterfall", "mountain-waterfall", ["nature", "calm"], "portrait-38", [["waterfall-band", "periwinkle"]]],
  ["Red Sunset", "red-sunset", ["nature", "modern"], "portrait-14", [["red-sunset-band", "wine"]]],
  ["Basketball", "basketball", ["sport"], "portrait-15", [["basketball-page", "ink"]]],
  ["Cricket", "cricket", ["sport"], "portrait-30", [["cricket-page", "ink"]]],
  ["Football", "football", ["sport"], "portrait-17", [["football-page", "ink"]]],
  ["Golf", "golf", ["sport", "calm"], "portrait-36", [["golf-page", "ink"]]],
  ["Rugby", "rugby", ["sport"], "portrait-20", [["rugby-page", "ink"]]],
  ["Rainbow Sky", "rainbow-sky", ["child", "colourful"], "portrait-22"],
  ["Rabbit Blue", "rabbit-blue", ["pets"], "portrait-23"],
  ["White Rabbits", "white-rabbits", ["pets"], "portrait-24"],
  ["Paw Prints Green", "paw-prints-green", ["pets"], "portrait-25"],
  ["Paw Prints Lilac", "paw-prints-lilac", ["pets"], "portrait-26"],
];

export const THEMED_TEMPLATE_SPECS: ThemedTemplateSpec[] = CURATED_THEMED.map(
  ([name, design, categories, portrait, backgrounds]) => ({
    slug: slugForName(name),
    name,
    design,
    categories,
    portrait,
    person: PEOPLE[portrait],
    ...(backgrounds?.length ? { backgrounds } : {}),
  }),
);
