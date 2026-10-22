/**
 * The classic family: the business's own long-standing range of plain, formal
 * covers, under their original names — a line border (square or notched), a
 * portrait, the name, "Sunrise / Sunset" and the service details set out in
 * full, on white, a pastel ground or a deep one. Each was measured from the
 * existing covers and rebuilt from the editor's own vocabulary (frames, filled
 * panels, the hand-drawn ornaments in Ornaments.tsx) so a customer can edit
 * every part of it.
 *
 * Pure and DB-free like templateGenerator.ts, whose placeholder wording this
 * shares; src/db/generateTemplates.ts writes these to the booklet product.
 * A design is a cover plus its `chrome` — the border, ground panels and
 * ornaments — which the interior and back pages repeat, so the whole booklet
 * reads as one piece.
 */

import {
  PAGE_H_MM,
  PAGE_W_MM,
  TEMPLATE_PAGE_COUNT,
  uid,
  type CanvasElement,
  type ClipartElement,
  type DesignPage,
  type FontFamilyId,
  type FrameElement,
  type ImageElement,
  type ShapeElement,
  type TextElement,
} from "@/lib/designEditor";
import type { PlaceholderPortraitId } from "@/lib/placeholderPortraits";
import {
  FAREWELL,
  PLACEHOLDER_INTERIOR,
  PLACEHOLDER_NAME,
  PLACEHOLDER_SERVICE,
  THANKS,
} from "@/lib/templateGenerator";

/*
 * Placeholder wording, in the long forms these covers print. Every one is
 * flagged `placeholder`, so the pre-order check warns if it's left as is.
 */
export const SUNRISE_SUNSET = "Sunrise: 1st May 1936 - Sunset: 12th June 2024";
export const SUNRISE_SUNSET_STACKED = "Sunrise: 1st May 1936\nSunset: 12th June 2024";
export const DATES_LONG = "1st May 1936 - 12th June 2024";
export const SERVICE_DAY = "Tuesday 16th June 2026";
export const SERVICE_TIME = "11.00am";
export const SERVICE_WHEN = "Tuesday 16th June 2026\n11.00am";
export const SERVICE_WHEN_AT = "Tuesday 16th June 2026\nat 11.00am";
export const SERVICE_WHEN_LINE = "Tuesday 16th June 2026 at 11.00am";
export const SERVICE_WHEN_DASH = "Tuesday 16th June 2026 - 11.00am";
export const CHURCH = "St Mary's Church";
export const ADDRESS = "Church Road\nReading RG1 2AB";
export const VENUE = `${CHURCH}\n${ADDRESS}`;
export const VENUE_LINE = "St Mary's Church, Church Road, Reading RG1 2AB";
export const VENUE_SHORT = "St Mary's Church, Reading";
export const VENUE_TWO_LINES = "St Mary's Church,\nChurch Road, Reading RG1 2AB";
export const INTERMENT = "Reading Crematorium\nAll Hallows Road\nReading RG4 5LP";

/** The square-box height (in % of page height) for a width in % of page width. */
export const squareH = (w: number) => (w * PAGE_W_MM) / PAGE_H_MM;

type TextProps = Omit<TextElement, "id" | "type" | "placeholder" | "align"> & {
  align?: TextElement["align"];
};

/** Wording that is part of the design ("Service:", "In Loving Memory"). */
export const fixed = ({ align = "center", ...props }: TextProps): CanvasElement => ({
  id: uid("text"),
  type: "text",
  align,
  ...props,
});

/** Wording the family replaces — the name, dates, service details. */
export const field = (props: TextProps): CanvasElement => ({ ...fixed(props), placeholder: true }) as CanvasElement;

export const photo = (props: Omit<ImageElement, "id" | "type" | "src">): CanvasElement => ({
  id: uid("image"),
  type: "image",
  src: null,
  ...props,
});

export const frame = (props: Omit<FrameElement, "id" | "type">): CanvasElement => ({
  id: uid("frame"),
  type: "frame",
  ...props,
});

export const shape = (props: Omit<ShapeElement, "id" | "type">): CanvasElement => ({
  id: uid("shape"),
  type: "shape",
  ...props,
});

export const ornament = (props: Omit<ClipartElement, "id" | "type">): CanvasElement => ({
  id: uid("clipart"),
  type: "clipart",
  ...props,
});

/** A box `w`% wide holding artwork of the given width ÷ height. */
export const aspectBox = (x: number, y: number, w: number, aspect: number) => ({
  x,
  y,
  w,
  h: squareH(w) / aspect,
});

/** What the interior and back pages are typeset in. */
export interface PageType {
  paper: string;
  heading: FontFamilyId;
  body: FontFamilyId;
  script: FontFamilyId;
  ink: string;
  muted: string;
  accent: string;
}

export interface ClassicDesign {
  /** Page colour of every page. */
  paper: string;
  /** The border, ground panels and ornaments — on every page. */
  chrome: () => CanvasElement[];
  cover: () => CanvasElement[];
  type: Omit<PageType, "paper">;
  /**
   * The interior page's own ground and chrome, for a design whose ground is
   * too dark to read a running order on page after page.
   */
  interior?: { type: PageType; chrome: () => CanvasElement[] };
  /**
   * Where the back page's farewell starts (percent of page height), for a
   * ground whose middle isn't clear — a flag's arrowhead. Default 37.
   */
  backTop?: number;
}

export const GREY_INK = "#2b2b2b";
export const GREY_MUTED = "#4a4a4a";

/** Notched line border, the portrait in a notched window to match. */
function notchedPortrait(): ClassicDesign {
  const line = "#555555";
  return {
    paper: "#ffffff",
    chrome: () => [frame({ variant: "single", corners: "notched", color: line, x: 7, y: 4.7, w: 86, h: 89.7 })],
    cover: () => [
      fixed({ text: "In Loving Memory", fontFamily: "ebGaramond", fontSize: 20, color: GREY_INK, x: 10, y: 9, w: 80, h: 0 }),
      photo({ shape: "notched", border: "single", borderColor: line, x: 27.3, y: 16, w: 45.5, h: 40.7 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 25, bold: true, uppercase: true, letterSpacing: 0.5, color: GREY_INK, x: 9, y: 58.6, w: 82, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 12.5, color: GREY_MUTED, x: 9, y: 64.7, w: 82, h: 0 }),
      fixed({ text: "Service:", fontFamily: "ebGaramond", fontSize: 13, bold: true, color: GREY_INK, x: 30, y: 69.7, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 13, italic: true, color: GREY_INK, x: 20, y: 72.4, w: 60, h: 0 }),
      field({ text: VENUE, fontFamily: "ebGaramond", fontSize: 13, italic: true, color: GREY_INK, x: 20, y: 78, w: 60, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "allura", ink: GREY_INK, muted: GREY_MUTED, accent: line },
  };
}

/** Notched line border, script overline, the name above a framed portrait. */
function notchedBorder(): ClassicDesign {
  const line = "#555555";
  return {
    paper: "#ffffff",
    chrome: () => [frame({ variant: "single", corners: "notched", color: line, x: 6.6, y: 4.2, w: 87, h: 90.7 })],
    cover: () => [
      fixed({ text: "In Loving Memory & Celebration for the Life of", fontFamily: "allura", fontSize: 21, color: "#3d3d3d", x: 8, y: 9.1, w: 84, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 25, bold: true, uppercase: true, letterSpacing: 0.5, color: GREY_INK, x: 8, y: 14.6, w: 84, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 12.5, color: GREY_MUTED, x: 8, y: 21.3, w: 84, h: 0 }),
      photo({ border: "single", borderColor: "#333333", x: 29.8, y: 26.3, w: 40.4, h: 36.8 }),
      fixed({ text: "Service at:", fontFamily: "ebGaramond", fontSize: 13, italic: true, color: GREY_INK, x: 30, y: 67.1, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN_DASH, fontFamily: "ebGaramond", fontSize: 13, bold: true, color: GREY_INK, x: 12, y: 69.7, w: 76, h: 0 }),
      field({ text: VENUE_LINE, fontFamily: "ebGaramond", fontSize: 13, bold: true, color: GREY_INK, x: 9, y: 75.3, w: 82, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "allura", ink: GREY_INK, muted: GREY_MUTED, accent: line },
  };
}

/** Deep burgundy ground, gold capitals, the portrait in a gold triple frame. */
function burgundyGold(): ClassicDesign {
  const gold = "#d4af6a";
  const cream = "#f6efe4";
  const burgundy = "#5a1a13";
  return {
    paper: burgundy,
    chrome: () => [],
    cover: () => [
      fixed({ text: "In Loving Memory Of", fontFamily: "marcellus", fontSize: 18, uppercase: true, letterSpacing: 1, color: gold, x: 10, y: 10.4, w: 80, h: 0 }),
      photo({ border: "triple", borderColor: gold, x: 22, y: 16, w: 55.8, h: 39.6 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 30, uppercase: true, letterSpacing: 1, color: gold, x: 6, y: 57.3, w: 88, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "marcellus", fontSize: 11.5, uppercase: true, color: gold, x: 6, y: 64.7, w: 88, h: 0 }),
      fixed({ text: "Service:", fontFamily: "marcellus", fontSize: 16, uppercase: true, color: gold, x: 25, y: 72, w: 50, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 13, color: cream, x: 20, y: 76.1, w: 60, h: 0 }),
      fixed({ text: "Venue:", fontFamily: "marcellus", fontSize: 16, uppercase: true, color: gold, x: 25, y: 82.3, w: 50, h: 0 }),
      field({ text: VENUE_TWO_LINES, fontFamily: "ebGaramond", fontSize: 13, color: cream, x: 12, y: 85.8, w: 76, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: gold, muted: cream, accent: gold },
    interior: {
      type: { paper: "#faf6ef", heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink: burgundy, muted: burgundy, accent: "#b8924a" },
      chrome: () => [frame({ variant: "double", color: burgundy, x: 6, y: 5, w: 88, h: 90 })],
    },
  };
}

/** No border at all: a large soft portrait between the name and the service. */
function simpleCelebration(): ClassicDesign {
  return {
    paper: "#ffffff",
    chrome: () => [],
    cover: () => [
      fixed({ text: "A Celebration of the Life of", fontFamily: "ebGaramond", fontSize: 21, color: "#333333", x: 8, y: 3.4, w: 84, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 37, color: GREY_INK, x: 6, y: 8.2, w: 88, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 12.5, color: GREY_MUTED, x: 8, y: 17.2, w: 84, h: 0 }),
      photo({ x: 24, y: 24.8, w: 51.8, h: 44.4 }),
      field({ text: PLACEHOLDER_SERVICE, fontFamily: "ebGaramond", fontSize: 16, color: GREY_INK, x: 12, y: 71.3, w: 76, h: 0 }),
      fixed({ text: "Sadly departed, but never forgotten", fontFamily: "ebGaramond", fontSize: 12.5, italic: true, color: GREY_MUTED, x: 15, y: 81.8, w: 70, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "allura", ink: GREY_INK, muted: GREY_MUTED, accent: "#8a8a8a" },
  };
}

/** Quiet sans-serif top, portrait, then "Order of Service" in script over a swash. */
function scriptOrder(): ClassicDesign {
  return {
    paper: "#ffffff",
    chrome: () => [],
    cover: () => [
      fixed({ text: "In Loving Memory of", fontFamily: "lato", fontSize: 12.5, color: "#333333", x: 20, y: 6.1, w: 60, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 30, color: GREY_INK, x: 8, y: 10.3, w: 84, h: 0 }),
      field({ text: DATES_LONG, fontFamily: "lato", fontSize: 13, color: GREY_MUTED, x: 10, y: 16.6, w: 80, h: 0 }),
      photo({ x: 29.8, y: 25.1, w: 40.1, h: 33.7 }),
      fixed({ text: "Order of Service", fontFamily: "italianno", fontSize: 46, color: "#333333", x: 12, y: 71.5, w: 70, h: 0 }),
      ornament({ icon: "swash", color: "#444444", ...aspectBox(40, 82.4, 20, 4) }),
      field({ text: VENUE_SHORT, fontFamily: "lato", fontSize: 12.5, color: "#333333", x: 15, y: 89.6, w: 70, h: 0 }),
    ],
    type: { heading: "marcellus", body: "lato", script: "italianno", ink: GREY_INK, muted: GREY_MUTED, accent: "#8a8a8a" },
  };
}

/**
 * A pastel ground inside a white margin, white script, and the portrait and
 * name on a white card. One composition, two grounds.
 */
function pastelCard(ground: string): ClassicDesign {
  return {
    paper: "#ffffff",
    chrome: () => [
      shape({ shape: "rect", color: ground, fill: ground, strokeWidth: 1, x: 6.3, y: 4.4, w: 87.4, h: 91.2 }),
      frame({ variant: "single", color: "#ffffff", x: 7.4, y: 5.2, w: 85.2, h: 89.6 }),
    ],
    cover: () => [
      fixed({ text: "In Loving Memory", fontFamily: "allura", fontSize: 27, color: "#ffffff", x: 15, y: 9.3, w: 70, h: 0 }),
      shape({ shape: "rect", color: "#ffffff", fill: "#ffffff", strokeWidth: 1, x: 28.3, y: 17.8, w: 42.9, h: 49 }),
      frame({ variant: "single", color: ground, x: 28.9, y: 18.2, w: 41.7, h: 48.2 }),
      photo({ x: 29.6, y: 18.7, w: 40.3, h: 28.5 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "ebGaramond", fontSize: 22, bold: true, color: GREY_INK, x: 29, y: 50.6, w: 41.5, h: 0 }),
      field({ text: SUNRISE_SUNSET_STACKED, fontFamily: "ebGaramond", fontSize: 12.5, color: GREY_INK, x: 29, y: 59.9, w: 41.5, h: 0 }),
      fixed({ text: "Service:", fontFamily: "ebGaramond", fontSize: 13, bold: true, color: GREY_INK, x: 30, y: 72.6, w: 40, h: 0 }),
      field({ text: SERVICE_WHEN, fontFamily: "ebGaramond", fontSize: 13, italic: true, color: GREY_INK, x: 20, y: 75.1, w: 60, h: 0 }),
      field({ text: VENUE, fontFamily: "ebGaramond", fontSize: 13, italic: true, color: GREY_INK, x: 15, y: 82.3, w: 70, h: 0 }),
    ],
    type: { heading: "ebGaramond", body: "ebGaramond", script: "allura", ink: GREY_INK, muted: GREY_INK, accent: "#ffffff" },
  };
}

/** Blush ground inside a gold scrolled cartouche, the portrait in a gold frame. */
function gildedScroll(): ClassicDesign {
  const gold = "#c9a35b";
  const ink = "#3b3b3b";
  return {
    paper: "#faebe1",
    chrome: () => [ornament({ icon: "scroll-frame", color: gold, ...aspectBox(4.75, 2.75, 90.5, 135 / 200) })],
    cover: () => [
      fixed({ text: "The Funeral Mass for the Repose of the Soul of", fontFamily: "pinyonScript", fontSize: 15, color: "#555555", x: 14, y: 15.2, w: 72, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 20, bold: true, uppercase: true, letterSpacing: 1, color: ink, x: 14, y: 19.3, w: 72, h: 0 }),
      photo({ border: "double", borderColor: gold, x: 29.5, y: 26.5, w: 40.7, h: 34.9 }),
      field({ text: SUNRISE_SUNSET_STACKED, fontFamily: "marcellus", fontSize: 15, uppercase: true, color: ink, x: 12, y: 64.7, w: 76, h: 0 }),
      field({ text: VENUE_SHORT, fontFamily: "marcellus", fontSize: 13, uppercase: true, color: ink, x: 12, y: 74.9, w: 76, h: 0 }),
      field({ text: SERVICE_WHEN_AT, fontFamily: "marcellus", fontSize: 13, uppercase: true, color: ink, x: 12, y: 79.9, w: 76, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent: gold },
  };
}

/** Thick soft-grey outer rule and a fine inner one; the service set out line by line. */
function silverBorder(): ClassicDesign {
  return {
    paper: "#ffffff",
    chrome: () => [
      shape({ shape: "rect", color: "#bdbdbd", strokeWidth: 4, x: 7, y: 5.1, w: 86, h: 89.7 }),
      frame({ variant: "single", color: "#8c8c8c", x: 11.3, y: 8.2, w: 77.4, h: 83.6 }),
    ],
    cover: () => [
      fixed({ text: "In Loving Memory", fontFamily: "marcellus", fontSize: 22, uppercase: true, letterSpacing: 1, color: "#333333", x: 14, y: 12.5, w: 72, h: 0 }),
      photo({ border: "single", borderColor: "#999999", x: 29.8, y: 20.1, w: 40.6, h: 34.6 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "inter", fontSize: 23, bold: true, uppercase: true, color: GREY_INK, x: 13, y: 57.8, w: 74, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 12.5, color: GREY_MUTED, x: 13, y: 62.9, w: 74, h: 0 }),
      fixed({ text: "Service", fontFamily: "ebGaramond", fontSize: 13, bold: true, uppercase: true, color: GREY_INK, x: 30, y: 69.4, w: 40, h: 0 }),
      fixed({ text: "on", fontFamily: "ebGaramond", fontSize: 12.5, color: GREY_MUTED, x: 40, y: 73.7, w: 20, h: 0 }),
      field({ text: SERVICE_DAY, fontFamily: "ebGaramond", fontSize: 15, color: GREY_INK, x: 15, y: 76, w: 70, h: 0 }),
      fixed({ text: "at", fontFamily: "ebGaramond", fontSize: 12.5, color: GREY_MUTED, x: 40, y: 80.9, w: 20, h: 0 }),
      field({ text: SERVICE_TIME, fontFamily: "ebGaramond", fontSize: 15, color: GREY_INK, x: 30, y: 83.2, w: 40, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "allura", ink: GREY_INK, muted: GREY_MUTED, accent: "#8c8c8c" },
  };
}

/** Peach ground, scrolled rules top and bottom, the portrait in a fine frame. */
function peachScroll(): ClassicDesign {
  const accent = "#d9825a";
  const ink = "#3d2b26";
  const divider = (y: number) => ornament({ icon: "scroll-divider", color: accent, ...aspectBox(26, y, 48, 8) });
  return {
    paper: "#f1c4a9",
    chrome: () => [divider(3.4), divider(92.4)],
    cover: () => [
      fixed({ text: "In Loving Memory Of", fontFamily: "pinyonScript", fontSize: 30, color: ink, x: 10, y: 10.6, w: 80, h: 0 }),
      frame({ variant: "single", color: accent, x: 29.8, y: 18.7, w: 41.4, h: 46.3 }),
      photo({ x: 32.5, y: 20.8, w: 36.4, h: 42.9 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 23, bold: true, uppercase: true, letterSpacing: 1, color: ink, x: 10, y: 67.7, w: 80, h: 0 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 13, bold: true, color: ink, x: 8, y: 72.8, w: 84, h: 0 }),
      field({ text: SERVICE_WHEN_LINE, fontFamily: "ebGaramond", fontSize: 11.5, color: ink, x: 12, y: 78.6, w: 76, h: 0 }),
      field({ text: CHURCH, fontFamily: "ebGaramond", fontSize: 13, bold: true, color: ink, x: 20, y: 82.4, w: 60, h: 0 }),
      field({ text: ADDRESS, fontFamily: "ebGaramond", fontSize: 13, color: ink, x: 20, y: 84.9, w: 60, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "pinyonScript", ink, muted: ink, accent },
  };
}

/** Fine double border with diamond corners, an oval portrait, a dove at the foot. */
function doveOfPeace(): ClassicDesign {
  const dark = "#2b2b2b";
  const pale = "#cfcfcf";
  const box = { x: 5.7, y: 4.3, w: 88.6, h: 91.4 };
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  const square = 3.7;
  const diamond = 1.8;
  return {
    paper: "#ffffff",
    chrome: () => [
      frame({ variant: "single", color: dark, ...box }),
      frame({ variant: "single", color: pale, x: box.x + 1.4, y: box.y + 1, w: box.w - 2.8, h: box.h - 2 }),
      ...corners.flatMap(([cx, cy]) => [
        shape({ shape: "rect", color: pale, strokeWidth: 1, x: cx - square / 2, y: cy - squareH(square) / 2, w: square, h: squareH(square) }),
        shape({ shape: "rect", color: dark, fill: dark, strokeWidth: 1, rotation: 45, x: cx - diamond / 2, y: cy - squareH(diamond) / 2, w: diamond, h: squareH(diamond) }),
      ]),
    ],
    cover: () => [
      fixed({ text: "Thank you for joining us to say farewell and celebrate the life of", fontFamily: "pinyonScript", fontSize: 13, color: "#555555", x: 10, y: 8.9, w: 80, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 21, uppercase: true, letterSpacing: 0.5, color: dark, x: 10, y: 12.3, w: 80, h: 0 }),
      photo({ shape: "oval", border: "single", borderColor: "#8a8a8a", x: 30.1, y: 19, w: 39, h: 33.5 }),
      field({ text: DATES_LONG, fontFamily: "marcellus", fontSize: 20, uppercase: true, color: dark, x: 8, y: 55.6, w: 84, h: 0 }),
      field({ text: `${SERVICE_DAY}, ${SERVICE_TIME}`, fontFamily: "mulish", fontSize: 13, bold: true, color: dark, x: 12, y: 64, w: 76, h: 0 }),
      field({ text: CHURCH, fontFamily: "mulish", fontSize: 13, bold: true, color: dark, x: 20, y: 69.1, w: 60, h: 0 }),
      field({ text: ADDRESS, fontFamily: "mulish", fontSize: 13, color: dark, x: 20, y: 71.5, w: 60, h: 0 }),
      ornament({ icon: "dove", color: "#6b6b6b", ...aspectBox(43, 80.5, 14, 64 / 48) }),
    ],
    type: { heading: "marcellus", body: "mulish", script: "pinyonScript", ink: dark, muted: GREY_MUTED, accent: dark },
  };
}

/** No border: blue capitals, a blue-ringed oval, the service and interment side by side. */
function blueOval(): ClassicDesign {
  const blue = "#3a8db8";
  return {
    paper: "#ffffff",
    chrome: () => [],
    cover: () => [
      fixed({ text: "In Loving Memory Of", fontFamily: "ebGaramond", fontSize: 13, italic: true, color: "#333333", x: 20, y: 10.5, w: 60, h: 0 }),
      field({ text: PLACEHOLDER_NAME, fontFamily: "marcellus", fontSize: 25, uppercase: true, letterSpacing: 1, color: blue, x: 8, y: 15.7, w: 84, h: 0 }),
      photo({ shape: "oval", x: 25.7, y: 22.5, w: 47.2, h: 39.6 }),
      shape({ shape: "circle", color: blue, strokeWidth: 3.5, x: 25.7, y: 22.5, w: 47.2, h: 39.6 }),
      field({ text: SUNRISE_SUNSET, fontFamily: "ebGaramond", fontSize: 15, color: GREY_INK, x: 6, y: 64.9, w: 88, h: 0 }),
      field({ text: SERVICE_DAY, fontFamily: "ebGaramond", fontSize: 13, bold: true, color: GREY_INK, x: 20, y: 71, w: 60, h: 0 }),
      fixed({ text: "Thanksgiving Service:", fontFamily: "ebGaramond", fontSize: 12.5, italic: true, align: "left", color: blue, x: 16.2, y: 76.4, w: 34, h: 0 }),
      fixed({ text: "Interment:", fontFamily: "ebGaramond", fontSize: 12.5, italic: true, align: "right", color: blue, x: 49.6, y: 76.4, w: 34, h: 0 }),
      field({ text: VENUE, fontFamily: "ebGaramond", fontSize: 12.5, align: "left", color: GREY_INK, x: 16.2, y: 80.7, w: 34, h: 0 }),
      field({ text: INTERMENT, fontFamily: "ebGaramond", fontSize: 12.5, align: "right", color: GREY_INK, x: 49.6, y: 80.7, w: 34, h: 0 }),
    ],
    type: { heading: "marcellus", body: "ebGaramond", script: "allura", ink: GREY_INK, muted: GREY_MUTED, accent: blue },
  };
}

const CLASSIC_DESIGNS = {
  "border-corner-2": notchedPortrait,
  "border-corners": notchedBorder,
  "classic-posh": burgundyGold,
  "classic-template": simpleCelebration,
  "classic-template-2": scriptOrder,
  "classic-template-blue": () => pastelCard("#b3e0f6"),
  "classic-template-peach": () => pastelCard("#f7d5ae"),
  "order-of-gold": gildedScroll,
  "outer-border": silverBorder,
  "peach-tones": peachScroll,
  "single-dove": doveOfPeace,
  "star": blueOval,
} satisfies Record<string, () => ClassicDesign>;

export type ClassicDesignId = keyof typeof CLASSIC_DESIGNS;

export const CLASSIC_DESIGN_IDS = Object.keys(CLASSIC_DESIGNS) as ClassicDesignId[];

/** The repeating interior page: the design's chrome and the generic placeholder. */
function interiorPage(type: PageType, chrome: CanvasElement[]): CanvasElement[] {
  return [
    ...chrome,
    shape({ shape: "line", color: type.accent, strokeWidth: 1, x: 35, y: 41, w: 30, h: 0.3 }),
    field({ text: PLACEHOLDER_INTERIOR, fontFamily: type.heading, fontSize: 26, letterSpacing: 2, color: type.muted, x: 12, y: 46, w: 76, h: 0 }),
    shape({ shape: "line", color: type.accent, strokeWidth: 1, x: 35, y: 57, w: 30, h: 0.3 }),
  ];
}

function backPage(type: PageType, chrome: CanvasElement[], top = 37): CanvasElement[] {
  return [
    ...chrome,
    fixed({ text: FAREWELL, fontFamily: type.script, fontSize: 30, color: type.ink, x: 10, y: top, w: 80, h: 0 }),
    fixed({ text: THANKS, fontFamily: type.body, fontSize: 13, color: type.muted, x: 15, y: top + 13, w: 70, h: 0 }),
  ];
}

/** Cover, interior and back for one design — always TEMPLATE_PAGE_COUNT pages. */
export function buildClassicLayout(id: ClassicDesignId): DesignPage[] {
  return buildDesignPages(CLASSIC_DESIGNS[id]());
}

/** The three pages of any design in this family's shape. */
export function buildDesignPages(design: ClassicDesign): DesignPage[] {
  const type: PageType = { paper: design.paper, ...design.type };
  const interior = design.interior ?? { type, chrome: design.chrome };
  const pages: DesignPage[] = [
    { id: uid("page"), background: design.paper, elements: [...design.chrome(), ...design.cover()] },
    { id: uid("page"), background: interior.type.paper, elements: interiorPage(interior.type, interior.chrome()) },
    { id: uid("page"), background: design.paper, elements: backPage(type, design.chrome(), design.backTop) },
  ];
  if (pages.length !== TEMPLATE_PAGE_COUNT) {
    throw new Error(`Expected ${TEMPLATE_PAGE_COUNT} pages, built ${pages.length}`);
  }
  return pages;
}

export interface ClassicTemplateSpec {
  slug: string;
  name: string;
  design: ClassicDesignId;
  categories: string[];
  /**
   * The stand-in portrait its preview is drawn with, pinned on create — these
   * covers carry no artwork, so the automatic pick would make every one
   * black and white.
   */
  portrait: PlaceholderPortraitId;
}

const CURATED_CLASSIC: Array<
  [name: string, design: ClassicDesignId, categories: string[], portrait: PlaceholderPortraitId]
> = [
  ["Vintage Frame", "border-corner-2", ["classic", "simple"], "portrait-4"],
  ["Border Corners", "border-corners", ["classic", "simple"], "portrait-5"],
  ["Classic Posh", "classic-posh", ["classic", "colourful"], "portrait-1"],
  ["Simple Celebration", "classic-template", ["simple", "minimalistic"], "portrait-6"],
  ["Graceful Script", "classic-template-2", ["simple", "minimalistic", "classic"], "portrait-7"],
  ["Pastel Blue", "classic-template-blue", ["colourful", "calm"], "portrait-8"],
  ["Pastel Peach", "classic-template-peach", ["colourful", "calm"], "portrait-9"],
  ["Order of Gold", "order-of-gold", ["classic", "religious"], "portrait-6"],
  ["Outer Border", "outer-border", ["classic", "simple"], "portrait-2"],
  ["Peach Tones", "peach-tones", ["colourful", "classic"], "portrait-7"],
  ["Single Dove", "single-dove", ["religious", "birds", "classic"], "portrait-8"],
  ["Star", "star", ["modern", "simple"], "portrait-5"],
];

export const CLASSIC_TEMPLATE_SPECS: ClassicTemplateSpec[] = CURATED_CLASSIC.map(
  ([name, design, categories, portrait]) => ({
    // The design id is the slug, not the name: slugs are immutable (URLs, order
    // history), and a name is customer copy that can be improved.
    slug: design,
    name,
    design,
    categories,
    portrait,
  }),
);
