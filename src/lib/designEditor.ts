/**
 * Document model for the /design editor.
 *
 * Coordinates are stored as percentages of the page (x/w against page width,
 * y/h against page height) so a document is independent of zoom level.
 * Font sizes are px at the base page size (PAGE_W x PAGE_H) and scale with
 * the page via CSS transform.
 */

import type { Template } from "@/lib/templates";

/**
 * Base on-screen sizing at 100% zoom, 3px/mm.
 *
 * PAGE_W/PAGE_H are the trim size — A5 portrait (148 x 210mm), the finished
 * cut size and the coordinate system every element's x/y/w/h percentage is
 * measured against. BLEED_PX is a 3mm bleed margin that extends beyond the
 * trim on every side; ARTBOARD_W/ARTBOARD_H (trim + bleed both sides) is
 * only used for rendering and zoom-to-fit, never for element coordinates.
 */
export const PAGE_W_MM = 148;
export const PAGE_H_MM = 210;
export const PAGE_W = 444;
export const PAGE_H = 630;
export const BLEED_MM = 3;
export const BLEED_PX = (PAGE_W / PAGE_W_MM) * BLEED_MM;
export const ARTBOARD_W_MM = PAGE_W_MM + BLEED_MM * 2;
export const ARTBOARD_H_MM = PAGE_H_MM + BLEED_MM * 2;
export const ARTBOARD_W = PAGE_W + BLEED_PX * 2;
export const ARTBOARD_H = PAGE_H + BLEED_PX * 2;

/**
 * Element box (percent of the trim page) that covers the whole artboard,
 * bleed included. Element coordinates are measured against the trim box, so
 * a full-bleed background has to start slightly negative and overshoot 100%
 * — otherwise a hairline of bare paper shows at the cut line.
 */
export const FULL_BLEED_BOX = (() => {
  const bx = (BLEED_MM / PAGE_W_MM) * 100;
  const by = (BLEED_MM / PAGE_H_MM) * 100;
  return { x: -bx, y: -by, w: 100 + bx * 2, h: 100 + by * 2 } as const;
})();

export type FontFamilyId =
  | "display"
  | "body"
  | "script"
  | "playfair"
  | "cormorant"
  | "lora"
  | "ebGaramond"
  | "cormorantAlt"
  | "libreBaskerville"
  | "marcellus"
  | "prata"
  | "spectral"
  | "vollkorn"
  | "domine"
  | "ptSerif"
  | "merriweather"
  | "cardo"
  | "alegreya"
  | "inter"
  | "lato"
  | "karla"
  | "nunitoSans"
  | "raleway"
  | "josefinSans"
  | "cabin"
  | "quicksand"
  | "mulish"
  | "dancing"
  | "alexBrush"
  | "tangerine"
  | "sacramento"
  | "parisienne"
  | "allura"
  | "petitFormalScript"
  | "mrsSaintDelafield"
  | "pinyonScript"
  | "italianno"
  | "meddon"
  | "herrVonMuellerhoff"
  | "meaCulpa"
  | "windsong"
  | "marckScript"
  | "yesteryear"
  | "leagueScript"
  | "rougeScript"
  | "ballet"
  | "laBelleAurore"
  | "courgette"
  | "satisfy"
  | "kristi";

export interface FontOption {
  id: FontFamilyId;
  label: string;
  css: string;
}

/** ~50 Google Fonts grouped serif / sans / script to match the picker's layout. */
export const FONT_OPTIONS: FontOption[] = [
  // Serif / display
  { id: "display", label: "Source Serif", css: "var(--font-display)" },
  { id: "playfair", label: "Playfair Display", css: "var(--font-playfair), serif" },
  { id: "cormorant", label: "Cormorant Garamond", css: "var(--font-cormorant), serif" },
  { id: "lora", label: "Lora", css: "var(--font-lora), serif" },
  { id: "ebGaramond", label: "EB Garamond", css: "var(--font-eb-garamond), serif" },
  { id: "cormorantAlt", label: "Cormorant", css: "var(--font-cormorant-alt), serif" },
  { id: "libreBaskerville", label: "Libre Baskerville", css: "var(--font-libre-baskerville), serif" },
  { id: "marcellus", label: "Marcellus", css: "var(--font-marcellus), serif" },
  { id: "prata", label: "Prata", css: "var(--font-prata), serif" },
  { id: "spectral", label: "Spectral", css: "var(--font-spectral), serif" },
  { id: "vollkorn", label: "Vollkorn", css: "var(--font-vollkorn), serif" },
  { id: "domine", label: "Domine", css: "var(--font-domine), serif" },
  { id: "ptSerif", label: "PT Serif", css: "var(--font-pt-serif), serif" },
  { id: "merriweather", label: "Merriweather", css: "var(--font-merriweather), serif" },
  { id: "cardo", label: "Cardo", css: "var(--font-cardo), serif" },
  { id: "alegreya", label: "Alegreya", css: "var(--font-alegreya), serif" },

  // Sans body
  { id: "body", label: "Work Sans", css: "var(--font-body)" },
  { id: "inter", label: "Inter", css: "var(--font-inter), sans-serif" },
  { id: "lato", label: "Lato", css: "var(--font-lato), sans-serif" },
  { id: "karla", label: "Karla", css: "var(--font-karla), sans-serif" },
  { id: "nunitoSans", label: "Nunito Sans", css: "var(--font-nunito-sans), sans-serif" },
  { id: "raleway", label: "Raleway", css: "var(--font-raleway), sans-serif" },
  { id: "josefinSans", label: "Josefin Sans", css: "var(--font-josefin-sans), sans-serif" },
  { id: "cabin", label: "Cabin", css: "var(--font-cabin), sans-serif" },
  { id: "quicksand", label: "Quicksand", css: "var(--font-quicksand), sans-serif" },
  { id: "mulish", label: "Mulish", css: "var(--font-mulish), sans-serif" },

  // Script / decorative
  { id: "script", label: "Script", css: "var(--font-script), cursive" },
  { id: "dancing", label: "Dancing Script", css: "var(--font-dancing), cursive" },
  { id: "alexBrush", label: "Alex Brush", css: "var(--font-alex-brush), cursive" },
  { id: "tangerine", label: "Tangerine", css: "var(--font-tangerine), cursive" },
  { id: "sacramento", label: "Sacramento", css: "var(--font-sacramento), cursive" },
  { id: "parisienne", label: "Parisienne", css: "var(--font-parisienne), cursive" },
  { id: "allura", label: "Allura", css: "var(--font-allura), cursive" },
  { id: "petitFormalScript", label: "Petit Formal Script", css: "var(--font-petit-formal-script), cursive" },
  { id: "mrsSaintDelafield", label: "Mrs Saint Delafield", css: "var(--font-mrs-saint-delafield), cursive" },
  { id: "pinyonScript", label: "Pinyon Script", css: "var(--font-pinyon-script), cursive" },
  { id: "italianno", label: "Italianno", css: "var(--font-italianno), cursive" },
  { id: "meddon", label: "Meddon", css: "var(--font-meddon), cursive" },
  { id: "herrVonMuellerhoff", label: "Herr Von Muellerhoff", css: "var(--font-herr-von-muellerhoff), cursive" },
  { id: "meaCulpa", label: "Mea Culpa", css: "var(--font-mea-culpa), cursive" },
  { id: "windsong", label: "WindSong", css: "var(--font-windsong), cursive" },
  { id: "marckScript", label: "Marck Script", css: "var(--font-marck-script), cursive" },
  { id: "yesteryear", label: "Yesteryear", css: "var(--font-yesteryear), cursive" },
  { id: "leagueScript", label: "League Script", css: "var(--font-league-script), cursive" },
  { id: "rougeScript", label: "Rouge Script", css: "var(--font-rouge-script), cursive" },
  { id: "ballet", label: "Ballet", css: "var(--font-ballet), cursive" },
  { id: "laBelleAurore", label: "La Belle Aurore", css: "var(--font-la-belle-aurore), cursive" },
  { id: "courgette", label: "Courgette", css: "var(--font-courgette), cursive" },
  { id: "satisfy", label: "Satisfy", css: "var(--font-satisfy), cursive" },
  { id: "kristi", label: "Kristi", css: "var(--font-kristi), cursive" },
];

/** Muted ink palette for on-page content ("Serene Legacy" friendly). */
export const INK_PALETTE = [
  "#1f1a1e",
  "#4f434c",
  "#511552",
  "#6b2d6a",
  "#226b3d",
  "#5b4a2f",
  "#33506b",
  "#81737d",
  "#ffffff",
];

/** Paper-tone options for a page's background (print canvas, not site theme). */
export const PAGE_BACKGROUND_PALETTE = [
  "#ffffff",
  "#f4f1ee",
  "#faf6ef",
  "#f2ede9",
  "#eef0ea",
  "#f0ecec",
];

interface ElementBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in degrees, clockwise, around the element's center. Undefined means 0. */
  rotation?: number;
  /**
   * A locked element is part of the template's artwork, not the customer's
   * content: on the customer path it can't be selected, moved, resized,
   * edited or deleted, and it never shows an outline. Only the template
   * authoring editor can toggle it. Used for full-bleed background artwork
   * so a customer can't drag the picture off the page.
   */
  locked?: boolean;
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  fontFamily: FontFamilyId;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  align: "left" | "center" | "right";
  color: string;
  letterSpacing?: number;
  uppercase?: boolean;
}

export type PhotoShape = "rect" | "oval" | "arch";

export interface ImageElement extends ElementBase {
  type: "image";
  /** Data/blob URL, or null for an empty photo placeholder. */
  src: string | null;
  /** @deprecated superseded by `shape`; kept so old saved docs still render. */
  round?: boolean;
  shape?: PhotoShape;
  /**
   * How the image fills its box. "cover" (the default) crops to fill, which
   * is what a customer's photo in a fixed window wants. "contain" fits the
   * whole image inside without cropping or distortion — required for a
   * transparent cutout, whose own edges are the artwork.
   */
  fit?: "cover" | "contain";
}

/** The effective window shape, honouring the legacy `round` flag. */
export function imageShape(el: ImageElement): PhotoShape {
  return el.shape ?? (el.round ? "oval" : "rect");
}

/**
 * CSS border-radius clipping the photo (and its placeholder border) to its
 * window shape. The arch radius is half the box width in base-page px — a
 * true semicircular top regardless of box aspect — which stays correct at
 * any zoom because pages scale via CSS transform, never by relayout.
 */
export function photoBorderRadius(el: ImageElement): string | undefined {
  const shape = imageShape(el);
  if (shape === "oval") return "50%";
  if (shape === "arch") {
    const r = ((el.w / 100) * PAGE_W) / 2;
    return `${r}px ${r}px 0 0`;
  }
  return undefined;
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: "rect" | "circle" | "line";
  color: string;
  strokeWidth: number;
}

export interface ClipartElement extends ElementBase {
  type: "clipart";
  icon: string;
  color: string;
}

export interface FrameElement extends ElementBase {
  type: "frame";
  variant: "single" | "double" | "triple";
  color: string;
}

export type CanvasElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | ClipartElement
  | FrameElement;

/** The four corner handles a selected element can be resized from. */
export type ResizeHandle = "nw" | "ne" | "sw" | "se";

export const RESIZE_HANDLES: readonly ResizeHandle[] = ["nw", "ne", "sw", "se"];

/** Minimum element footprint, in page percent, so a box can't be dragged away. */
export const MIN_ELEMENT_W = 4;
export const MIN_ELEMENT_H = 1;

/** The positional part of a CanvasElement — everything a resize touches. */
export interface ElementBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Re-pin the corner a resize is anchored on, for a rotated box.
 *
 * `resizeBox` keeps the opposite corner fixed in the element's *own* axes, but
 * CSS `rotate()` pivots around the box centre — so as the box grows, that
 * centre moves and swings the supposedly-pinned corner across the screen.
 * Offsetting the box by the screen-space drift of the centre cancels it out.
 * With no rotation this is a no-op (`cos = 1`, `sin = 0`).
 */
function pinRotatedAnchor(
  origin: ElementBox,
  box: ElementBox,
  cos: number,
  sin: number,
): ElementBox {
  // Percent units are relative to different page dimensions, so the rotation
  // maths has to happen in pixels and convert back one axis at a time.
  const driftX = ((origin.x + origin.w / 2 - (box.x + box.w / 2)) / 100) * PAGE_W;
  const driftY = ((origin.y + origin.h / 2 - (box.y + box.h / 2)) / 100) * PAGE_H;
  const offsetX = driftX - (driftX * cos - driftY * sin);
  const offsetY = driftY - (driftX * sin + driftY * cos);
  return {
    ...box,
    x: box.x + (offsetX / PAGE_W) * 100,
    y: box.y + (offsetY / PAGE_H) * 100,
  };
}

/**
 * Resize a box by dragging one of its four corner handles.
 *
 * `dx`/`dy` are the pointer delta in page percent, in *screen* axes. The corner
 * opposite the dragged handle stays pinned, so a west handle moves `x` as it
 * changes `w` (and a north handle moves `y` as it changes `h`) rather than
 * shifting the whole element. Clamping to the minimum size pins that opposite
 * edge too — dragging past it parks the box instead of flipping it inside out.
 *
 * `rotation` (degrees, matching `CanvasElement.rotation`) makes the handles
 * follow the element rather than the page: the pointer delta is mapped back
 * into the element's own axes so a corner still grows towards the cursor, and
 * the anchored corner is re-pinned against the centre-pivot drift.
 *
 * `autoHeight` is for text elements, whose rendered height is set by their
 * content (they store `h = 0`): there the vertical delta is ignored entirely
 * and only the width — which the caller turns into a font size — responds.
 */
export function resizeBox(
  origin: ElementBox,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  { autoHeight = false, rotation = 0 }: { autoHeight?: boolean; rotation?: number } = {},
): ElementBox {
  // The unrotated case is by far the common one, and routing it through the
  // trig below would only add floating-point noise to exact percentages.
  const rotated = rotation % 360 !== 0;
  const rad = (rotation * Math.PI) / 180;
  const cos = rotated ? Math.cos(rad) : 1;
  const sin = rotated ? Math.sin(rad) : 0;

  // Screen-space delta -> the element's own axes (an inverse rotation), again
  // via pixels because the two percent axes aren't the same scale.
  const pixelDx = (dx / 100) * PAGE_W;
  const pixelDy = (dy / 100) * PAGE_H;
  const localDx = rotated ? ((pixelDx * cos + pixelDy * sin) / PAGE_W) * 100 : dx;
  const localDy = rotated ? ((-pixelDx * sin + pixelDy * cos) / PAGE_H) * 100 : dy;

  const west = handle === "nw" || handle === "sw";
  const north = handle === "nw" || handle === "ne";

  let x = origin.x;
  let w: number;
  if (west) {
    const right = origin.x + origin.w;
    w = Math.max(MIN_ELEMENT_W, right - (origin.x + localDx));
    x = right - w;
  } else {
    w = Math.max(MIN_ELEMENT_W, origin.w + localDx);
  }

  if (autoHeight) {
    return pinRotatedAnchor(origin, { x, y: origin.y, w, h: origin.h }, cos, sin);
  }

  let y = origin.y;
  let h: number;
  if (north) {
    const bottom = origin.y + origin.h;
    h = Math.max(MIN_ELEMENT_H, bottom - (origin.y + localDy));
    y = bottom - h;
  } else {
    h = Math.max(MIN_ELEMENT_H, origin.h + localDy);
  }

  return pinRotatedAnchor(origin, { x, y, w, h }, cos, sin);
}

export interface DesignPage {
  id: string;
  elements: CanvasElement[];
  /** Page background colour (hex). Absent/undefined means white. */
  background?: string;
}

export interface DesignDoc {
  templateId: string;
  pages: DesignPage[];
}

let counter = 0;
export function uid(prefix = "el") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Accent colour a template's starter layout uses, keyed off its first category. */
export const CATEGORY_ACCENTS: Record<string, string> = {
  floral: "#6b2d6a",
  nature: "#226b3d",
  calm: "#226b3d",
  birds: "#226b3d",
  religious: "#5b4a2f",
  military: "#33506b",
  sport: "#33506b",
  classic: "#1f1a1e",
  modern: "#1f1a1e",
  minimalistic: "#81737d",
  simple: "#81737d",
  colourful: "#6b2d6a",
};

export function templateAccent(template: Template): string {
  // DB-loaded templates carry their first category's accent_hex directly;
  // the static map remains as the fallback for fixtures and seed data.
  if (template.accent) return template.accent;
  for (const category of template.categories) {
    const accent = CATEGORY_ACCENTS[category];
    if (accent) return accent;
  }
  return "#1f1a1e";
}

function coverElements(template: Template): CanvasElement[] {
  const accent = templateAccent(template);
  return [
    {
      id: uid("frame"),
      type: "frame",
      variant: "triple",
      color: accent,
      x: 4,
      y: 3,
      w: 92,
      h: 94,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Celebrating",
      fontFamily: "script",
      fontSize: 46,
      align: "center",
      color: "#1f1a1e",
      x: 10,
      y: 9.5,
      w: 80,
      h: 0,
    },
    {
      id: uid("text"),
      type: "text",
      text: "The life of",
      fontFamily: "body",
      fontSize: 13,
      align: "center",
      color: "#4f434c",
      uppercase: true,
      letterSpacing: 3,
      x: 15,
      y: 21,
      w: 70,
      h: 0,
    },
    {
      id: uid("image"),
      type: "image",
      src: null,
      shape: "oval",
      x: 30,
      y: 27.5,
      w: 40,
      h: 28.2,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Robert Bayne",
      fontFamily: "display",
      fontSize: 30,
      align: "center",
      color: "#1f1a1e",
      uppercase: true,
      letterSpacing: 1.5,
      x: 8,
      y: 61,
      w: 84,
      h: 0,
    },
    {
      id: uid("text"),
      type: "text",
      text: "1971 – 2024",
      fontFamily: "body",
      fontSize: 15,
      align: "center",
      color: "#4f434c",
      letterSpacing: 1,
      x: 20,
      y: 70.5,
      w: 60,
      h: 0,
    },
  ];
}

function orderPageElements(): CanvasElement[] {
  return [
    {
      id: uid("text"),
      type: "text",
      text: "Order of Service",
      fontFamily: "display",
      fontSize: 24,
      align: "center",
      color: "#1f1a1e",
      x: 10,
      y: 8,
      w: 80,
      h: 0,
    },
    {
      id: uid("shape"),
      type: "shape",
      shape: "line",
      color: "#81737d",
      strokeWidth: 1,
      x: 35,
      y: 14.5,
      w: 30,
      h: 0.3,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Opening Music\n\nWelcome & Introduction\n\nHymn — Abide With Me\n\nEulogy\n\nReading\n\nPrayers\n\nClosing Words",
      fontFamily: "body",
      fontSize: 14,
      align: "center",
      color: "#4f434c",
      x: 12,
      y: 20,
      w: 76,
      h: 0,
    },
  ];
}

function backPageElements(): CanvasElement[] {
  return [
    {
      id: uid("clipart"),
      type: "clipart",
      icon: "flower",
      color: "#81737d",
      x: 44,
      y: 26,
      w: 12,
      h: 8.5,
    },
    {
      id: uid("text"),
      type: "text",
      text: "Forever in our hearts",
      fontFamily: "script",
      fontSize: 30,
      align: "center",
      color: "#1f1a1e",
      x: 10,
      y: 38,
      w: 80,
      h: 0,
    },
    {
      id: uid("text"),
      type: "text",
      text: "The family would like to thank you\nfor your kindness, support and\npresence here today.",
      fontFamily: "body",
      fontSize: 13,
      align: "center",
      color: "#4f434c",
      x: 15,
      y: 52,
      w: 70,
      h: 0,
    },
  ];
}

export function makeBlankPage(): DesignPage {
  return { id: uid("page"), elements: [] };
}

/** Starter document for a template: cover, the order page repeated to fill, back page. */
export function makeStarterDoc(template: Template, pageCount: number): DesignDoc {
  const pages: DesignPage[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    if (index === 0) {
      pages.push({ id: uid("page"), elements: coverElements(template) });
    } else if (index === pageCount - 1) {
      pages.push({ id: uid("page"), elements: backPageElements() });
    } else {
      pages.push({ id: uid("page"), elements: orderPageElements() });
    }
  }
  return { templateId: template.id, pages };
}

/**
 * A template layout is exactly three authored pages: cover, one middle page,
 * and back. Per print-shop convention the middle page is the one that repeats
 * to fill whichever page-count option (4, 8, 12, …) the customer picks, so
 * authoring more than one of it would have nowhere to go in the finished
 * booklet — withPageCount() performs that expansion.
 */
export const TEMPLATE_PAGE_COUNT = 3;

/** Display names for the three authored template pages, by index. */
export const TEMPLATE_PAGE_LABELS = ["Cover", "Middle", "Back"] as const;

export function templatePageLabel(index: number): string {
  return TEMPLATE_PAGE_LABELS[index] ?? `Page ${index + 1}`;
}

/** The starting point for authoring a template that has no layout yet. */
export function makeTemplateLayout(template: Template): DesignPage[] {
  return makeStarterDoc(template, TEMPLATE_PAGE_COUNT).pages;
}

/**
 * Coerce a stored layout to the canonical cover/middle/back triple. Layouts
 * authored before this structure existed can be any length, so the authoring
 * editor normalises on load rather than rejecting them: the first page is the
 * cover, the last is the back, and the first interior page (when there is
 * one) becomes the middle that repeats.
 */
export function toTemplateLayout(pages: DesignPage[] | null): DesignPage[] | null {
  if (!pages || pages.length === 0) return null;
  if (pages.length === TEMPLATE_PAGE_COUNT) return pages;
  return [
    pages[0],
    pages.length >= 3 ? pages[1] : makeBlankPage(),
    pages.length >= 2 ? pages[pages.length - 1] : makeBlankPage(),
  ];
}

/** Deep-clones a page with fresh page and element ids — two pages must never share ids. */
function clonePageWithFreshIds(page: DesignPage): DesignPage {
  return {
    id: uid("page"),
    background: page.background,
    elements: page.elements.map(
      (element) => ({ ...structuredClone(element), id: uid(element.type) }) as CanvasElement,
    ),
  };
}

/**
 * Turn an admin-authored template layout (templates.layout) into a fresh
 * document. Every page and element gets a new id — two designs instantiated
 * from the same template must never share ids — and the page count is
 * reconciled to the requested length.
 */
export function instantiateLayout(
  templateId: string,
  layout: DesignPage[],
  pageCount: number,
): DesignDoc {
  const pages = layout.map(clonePageWithFreshIds);
  return withPageCount({ templateId, pages }, pageCount);
}

/**
 * Grow or shrink a document to the requested page count. Per print-shop
 * convention, a template only ever needs a cover, one middle page and a back
 * page: the cover (page 0) and back page (last) stay fixed, and interior
 * pages are filled by repeating the existing middle page — never blank-filled
 * on grow, and the back page is never truncated away on shrink.
 */
export function withPageCount(doc: DesignDoc, pageCount: number): DesignDoc {
  if (doc.pages.length === pageCount) return doc;
  if (doc.pages.length < 2 || pageCount < 2) {
    if (doc.pages.length > pageCount) {
      return { ...doc, pages: doc.pages.slice(0, Math.max(pageCount, 0)) };
    }
    const pages = [...doc.pages];
    while (pages.length < pageCount) pages.push(makeBlankPage());
    return { ...doc, pages };
  }
  const cover = doc.pages[0];
  const back = doc.pages[doc.pages.length - 1];
  const interior = doc.pages.slice(1, -1);
  const middle = interior[0] ?? makeBlankPage();
  const targetInteriorCount = pageCount - 2;
  const pages: DesignPage[] = [cover];
  for (let index = 0; index < targetInteriorCount; index += 1) {
    pages.push(index < interior.length ? interior[index] : clonePageWithFreshIds(middle));
  }
  pages.push(back);
  return { ...doc, pages };
}

/** POST body for /api/proof — everything /proof-render needs to reproduce the canvas. */
export interface ProofRequest {
  doc: DesignDoc;
}
