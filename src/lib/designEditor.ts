/**
 * Document model for the /design editor.
 *
 * Coordinates are stored as percentages of the page (x/w against page width,
 * y/h against page height) so a document is independent of zoom level.
 * Font sizes are px at the base scale (PX_PER_MM) and scale with the page via
 * CSS transform.
 */

import type { Template } from "@/lib/templates";

/**
 * Page formats.
 *
 * Every product is drawn at the same 3px per mm, whatever its size, so a
 * font size or a frame line means the same printed size on a bookmark as on
 * a booklet. A product's *format* (products.size_label / trim_*_mm /
 * template_pages, see ProductFormat) fixes its trim — the finished cut size
 * and the coordinate system every element's x/y/w/h percentage is measured
 * against. BLEED_MM extends beyond the trim on every side; the artboard
 * (trim + bleed both sides) is only used for rendering and zoom-to-fit,
 * never for element coordinates.
 *
 * A document carries its own trim (DesignDoc.trim), stamped from its product
 * when it is created, so a saved design or an order's doc_snapshot renders at
 * the right size without asking the catalogue. Designs saved before formats
 * existed have none and are A5, the booklet's trim.
 */
export const PX_PER_MM = 3;
export const BLEED_MM = 3;
export const BLEED_PX = PX_PER_MM * BLEED_MM;

/** A finished (trimmed) page size, portrait or landscape, in millimetres. */
export interface PageTrim {
  widthMm: number;
  heightMm: number;
}

/**
 * How many pages a product's template layout authors: the front alone (a
 * memory board), front and back (a flat card or bookmark), or the booklet's
 * cover, middle and back — see TEMPLATE_PAGE_COUNT.
 */
export type TemplatePageCount = 1 | 2 | 3;

/**
 * Everything about a product's physical shape that the editor, the previews
 * and the press need. Lives on the products row; client-safe.
 */
export interface ProductFormat {
  /** The finished size's name — "A5", "A6", "50 × 200 mm", "A4 to A0". */
  sizeLabel: string;
  trim: PageTrim;
  templatePages: TemplatePageCount;
  /**
   * The design prints at whichever page-count option the customer picks, and
   * that axis is the print *size* ("A3", "A1") rather than a page count. Only
   * sound for a family of sizes that share the trim's shape — the ISO A sizes
   * all do — since the artwork is the same percentages scaled, never
   * re-laid-out. `trim` is then the drawing size, not the only size.
   */
  sizedByOption: boolean;
  /** What the paper axis is called for this product ("Paper", "Finish"). */
  paperLabel: string;
}

export const A5_TRIM: PageTrim = { widthMm: 148, heightMm: 210 };

/** The order-of-service booklet's format — and every pre-format design's. */
export const BOOKLET_FORMAT: ProductFormat = {
  sizeLabel: "A5",
  trim: A5_TRIM,
  templatePages: 3,
  sizedByOption: false,
  paperLabel: "Paper",
};

/** The format columns of a products row, as the loaders select them. */
export interface ProductFormatRow {
  sizeLabel: string;
  trimWidthMm: number;
  trimHeightMm: number;
  templatePages: number;
  sizedByOption: boolean;
  paperLabel: string;
}

export function toProductFormat(row: ProductFormatRow): ProductFormat {
  const templatePages: TemplatePageCount =
    row.templatePages === 1 || row.templatePages === 2 ? row.templatePages : 3;
  return {
    sizeLabel: row.sizeLabel,
    trim: { widthMm: row.trimWidthMm, heightMm: row.trimHeightMm },
    templatePages,
    sizedByOption: row.sizedByOption,
    paperLabel: row.paperLabel,
  };
}

/** What the page-count axis is called for a product. */
export function pagesAxisLabel(format: ProductFormat): string {
  return format.sizedByOption ? "Size" : "Pages";
}

/** Pixel geometry of one page at 100% zoom (PX_PER_MM). */
export interface PageMetrics {
  /** Trim box, px. */
  pageW: number;
  pageH: number;
  /** Trim + bleed, px. */
  artboardW: number;
  artboardH: number;
  /** Trim + bleed, mm — the press sheet. */
  artboardWMm: number;
  artboardHMm: number;
}

export function pageMetrics(trim: PageTrim = A5_TRIM): PageMetrics {
  const pageW = trim.widthMm * PX_PER_MM;
  const pageH = trim.heightMm * PX_PER_MM;
  return {
    pageW,
    pageH,
    artboardW: pageW + BLEED_PX * 2,
    artboardH: pageH + BLEED_PX * 2,
    artboardWMm: trim.widthMm + BLEED_MM * 2,
    artboardHMm: trim.heightMm + BLEED_MM * 2,
  };
}

/** A document's trim; A5 for designs saved before documents carried one. */
export function docTrim(doc: { trim?: PageTrim }): PageTrim {
  return doc.trim ?? A5_TRIM;
}

export function sameTrim(a: PageTrim, b: PageTrim): boolean {
  return a.widthMm === b.widthMm && a.heightMm === b.heightMm;
}

/** "148 × 210 mm" */
export function trimText(trim: PageTrim): string {
  return `${trim.widthMm} × ${trim.heightMm} mm`;
}

/** A trim as a CSS aspect-ratio. */
export function trimAspect(trim: PageTrim): string {
  return `${trim.widthMm} / ${trim.heightMm}`;
}

/**
 * Covers on the shop front are laid out for an A5 page. This is how much
 * narrower a format's cover has to be to stand the same height — 1 for every
 * A size (they share A5's shape) and for anything wider, about a third for a
 * bookmark — so a tall format isn't drawn several times taller than its
 * neighbours.
 */
export function coverWidthFactor(trim: PageTrim): number {
  const ratio = trim.widthMm / trim.heightMm;
  const a5 = A5_TRIM.widthMm / A5_TRIM.heightMm;
  return ratio >= a5 * 0.98 ? 1 : ratio / a5;
}

/**
 * A product's size, for customer copy: "A5 (148 × 210 mm)", "50 × 200 mm",
 * or — for a board sold in several sizes — just its range, "A4 to A0".
 */
export function sizeText(format: ProductFormat): string {
  if (format.sizedByOption || format.sizeLabel.includes("mm")) return format.sizeLabel;
  return `${format.sizeLabel} (${trimText(format.trim)})`;
}

/**
 * The A5 booklet trim, in mm and px. Only the A5-only pieces use these
 * directly — the bulk template generator and the background-artwork renderer,
 * which build order-of-service artwork. Anything that draws a design takes
 * its size from the document (docTrim) or the product (ProductFormat).
 */
export const PAGE_W_MM = A5_TRIM.widthMm;
export const PAGE_H_MM = A5_TRIM.heightMm;
export const ARTBOARD_W_MM = PAGE_W_MM + BLEED_MM * 2;
export const ARTBOARD_H_MM = PAGE_H_MM + BLEED_MM * 2;

/**
 * The PageCanvas zoom that makes one artboard exactly one physical page.
 *
 * The canvas works in its own px/mm (PX_PER_MM), while CSS print sizing is
 * fixed at 96px per inch. Rendering the canvas at this zoom makes its box
 * measure the artboard in real millimetres, so a CSS `@page` of the same
 * size holds it exactly — which is what lets the press PDF come out of
 * Chromium's own printer with live text instead of a screenshot. The same
 * for every format, since every format is drawn at the same px/mm.
 */
export const PRINT_ZOOM = 96 / 25.4 / PX_PER_MM;

/**
 * Element box (percent of the trim page) that covers the whole artboard,
 * bleed included. Element coordinates are measured against the trim box, so
 * a full-bleed background has to start slightly negative and overshoot 100%
 * — otherwise a hairline of bare paper shows at the cut line.
 */
export function fullBleedBox(trim: PageTrim = A5_TRIM) {
  const bx = (BLEED_MM / trim.widthMm) * 100;
  const by = (BLEED_MM / trim.heightMm) * 100;
  return { x: -bx, y: -by, w: 100 + bx * 2, h: 100 + by * 2 } as const;
}

/** fullBleedBox for the A5 booklet — the generator's and background pipeline's. */
export const FULL_BLEED_BOX = fullBleedBox(A5_TRIM);

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
  // Its own variable, not --font-display: the site's heading face is now
  // Newsreader, and a saved design must keep printing in Source Serif.
  { id: "display", label: "Source Serif", css: "var(--font-source-serif), serif" },
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
  "#a3325f",
  "#7a1f2e",
  "#5e3a8c",
  "#2f5597",
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
  /**
   * Template wording the customer is expected to replace — the name, dates,
   * service details. Only these warn at the pre-order check when left
   * unchanged; fixed headings ("Order of Service") never do. Set by the
   * authoring editor and the generators, meaningless on a customer's own text.
   */
  placeholder?: boolean;
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
  /**
   * Optional line border drawn around the photo window, using the same
   * single/double/triple line pattern as a page `FrameElement`. It follows the
   * window shape, so an oval photo gets an oval border and an arch an arched
   * one. Undefined means no border.
   */
  border?: FrameVariant;
  /** Border colour; only meaningful when `border` is set. */
  borderColor?: string;
}

export type FrameVariant = "single" | "double" | "triple";

export const FRAME_VARIANTS: readonly FrameVariant[] = ["single", "double", "triple"];

/** Default colour for a photo border the moment one is switched on. */
export const DEFAULT_PHOTO_BORDER_COLOR = INK_PALETTE[0];

/** Gap between the lines of a frame, in base-page px. */
export const FRAME_RING_GAP = 4;

/**
 * Line widths of a frame from the outside in, in base-page px. A page border
 * and a photo border draw the same lines so the two match on one page.
 */
export function frameRings(variant: FrameVariant): number[] {
  if (variant === "single") return [1];
  if (variant === "double") return [1, 2.5];
  return [1, 1, 2.5];
}

/** Total depth a frame's lines and gaps occupy from the outer edge. */
export function frameDepth(variant: FrameVariant): number {
  return frameRings(variant).reduce((sum, width) => sum + width + FRAME_RING_GAP, 0);
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
 * `pageW` is the trim width in base px (pageMetrics), since `el.w` is a
 * percentage of it.
 */
export function photoBorderRadius(
  el: ImageElement,
  pageW: number = pageMetrics().pageW,
): string | undefined {
  const shape = imageShape(el);
  if (shape === "oval") return "50%";
  if (shape === "arch") {
    const r = ((el.w / 100) * pageW) / 2;
    return `${r}px ${r}px 0 0`;
  }
  return undefined;
}

/**
 * The border-radius of a box sitting `inset` base-page px inside the photo
 * window, so a border ring (or the photo inside it) keeps the window's shape:
 * an oval stays 50%, an arch's semicircle shrinks by the inset so the ring
 * runs parallel to the outer edge, and a rectangle stays square.
 */
export function photoInnerBorderRadius(
  el: ImageElement,
  inset: number,
  pageW: number = pageMetrics().pageW,
): string | undefined {
  const shape = imageShape(el);
  if (shape === "oval") return "50%";
  if (shape === "arch") {
    const r = Math.max(0, ((el.w / 100) * pageW) / 2 - inset);
    return `${r}px ${r}px 0 0`;
  }
  return undefined;
}

export interface FrameElement extends ElementBase {
  type: "frame";
  variant: FrameVariant;
  color: string;
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
  { pageW, pageH }: PageMetrics,
): ElementBox {
  // Percent units are relative to different page dimensions, so the rotation
  // maths has to happen in pixels and convert back one axis at a time.
  const driftX = ((origin.x + origin.w / 2 - (box.x + box.w / 2)) / 100) * pageW;
  const driftY = ((origin.y + origin.h / 2 - (box.y + box.h / 2)) / 100) * pageH;
  const offsetX = driftX - (driftX * cos - driftY * sin);
  const offsetY = driftY - (driftX * sin + driftY * cos);
  return {
    ...box,
    x: box.x + (offsetX / pageW) * 100,
    y: box.y + (offsetY / pageH) * 100,
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
 *
 * `trim` is the page's size: the two percent axes only share a scale on a
 * known page, which the rotated case needs.
 */
export function resizeBox(
  origin: ElementBox,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  {
    autoHeight = false,
    rotation = 0,
    trim = A5_TRIM,
  }: { autoHeight?: boolean; rotation?: number; trim?: PageTrim } = {},
): ElementBox {
  const metrics = pageMetrics(trim);
  const { pageW, pageH } = metrics;
  // The unrotated case is by far the common one, and routing it through the
  // trig below would only add floating-point noise to exact percentages.
  const rotated = rotation % 360 !== 0;
  const rad = (rotation * Math.PI) / 180;
  const cos = rotated ? Math.cos(rad) : 1;
  const sin = rotated ? Math.sin(rad) : 0;

  // Screen-space delta -> the element's own axes (an inverse rotation), again
  // via pixels because the two percent axes aren't the same scale.
  const pixelDx = (dx / 100) * pageW;
  const pixelDy = (dy / 100) * pageH;
  const localDx = rotated ? ((pixelDx * cos + pixelDy * sin) / pageW) * 100 : dx;
  const localDy = rotated ? ((-pixelDx * sin + pixelDy * cos) / pageH) * 100 : dy;

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
    return pinRotatedAnchor(origin, { x, y: origin.y, w, h: origin.h }, cos, sin, metrics);
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

  return pinRotatedAnchor(origin, { x, y, w, h }, cos, sin, metrics);
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
  /**
   * The trim every page is laid out on, stamped from the product when the
   * document is made. Absent on designs saved before formats existed — those
   * are all A5 (docTrim).
   */
  trim?: PageTrim;
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
      placeholder: true,
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
      placeholder: true,
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

/**
 * The interior page of a starter document, repeated to fill whichever page
 * count the customer picks.
 *
 * It has to stay **generic**. Whatever is here lands on every interior page —
 * twice even at the smallest 4-page option, twenty-two times at 24 — so it
 * carries decoration and an invitation to type, never specific content. An
 * order of service is singular (one service, one order), so putting a running
 * order here would produce a booklet asserting the service happens six times.
 * This matches the seeded catalogue and the bulk generator's middlePage.
 */
function interiorPageElements(): CanvasElement[] {
  return [
    {
      id: uid("shape"),
      type: "shape",
      shape: "line",
      color: "#81737d",
      strokeWidth: 1,
      x: 35,
      y: 41,
      w: 30,
      h: 0.3,
    },
    {
      id: uid("text"),
      type: "text",
      text: "YOUR TEXT HERE",
      placeholder: true,
      fontFamily: "display",
      fontSize: 26,
      align: "center",
      color: "#4f434c",
      letterSpacing: 2,
      x: 12,
      y: 46,
      w: 76,
      h: 0,
    },
    {
      id: uid("shape"),
      type: "shape",
      shape: "line",
      color: "#81737d",
      strokeWidth: 1,
      x: 35,
      y: 57,
      w: 30,
      h: 0.3,
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

/**
 * The starter content above is tuned for the A5 booklet. Another trim scales
 * its type by area — a card's lettering is smaller than a booklet's, a
 * board's far bigger — and keeps round photo windows round, since a window's
 * w and h are percentages of differently-sized axes. A5 is left untouched.
 */
function adaptToTrim(elements: CanvasElement[], trim: PageTrim): CanvasElement[] {
  if (sameTrim(trim, A5_TRIM)) return elements;
  const scale = Math.sqrt(
    (trim.widthMm * trim.heightMm) / (A5_TRIM.widthMm * A5_TRIM.heightMm),
  );
  const round = (value: number) => Math.round(value * 2) / 2;
  return elements.map((element) => {
    if (element.type === "text") {
      return {
        ...element,
        fontSize: round(element.fontSize * scale),
        letterSpacing:
          element.letterSpacing === undefined ? undefined : round(element.letterSpacing * scale),
      };
    }
    if ((element.type === "image" && imageShape(element) === "oval") || element.type === "clipart") {
      return { ...element, h: (element.w * trim.widthMm) / trim.heightMm };
    }
    return element;
  });
}

/**
 * The front of a flat product — a card, a bookmark, a board. One face carries
 * everything a booklet cover does, so it is a portrait, the name and the
 * dates under a short heading, stacked from the photo's real height (which
 * depends on the trim's shape).
 */
function flatFrontElements(template: Template, trim: PageTrim): CanvasElement[] {
  const accent = templateAccent(template);
  const photoW = 56;
  const photoH = (photoW * trim.widthMm) / trim.heightMm;
  const photoY = 15;
  const nameY = photoY + photoH + 5;
  return adaptToTrim(
    [
      {
        id: uid("frame"),
        type: "frame",
        variant: "double",
        color: accent,
        x: 4,
        y: 3,
        w: 92,
        h: 94,
      },
      {
        id: uid("text"),
        type: "text",
        text: "In loving memory",
        fontFamily: "script",
        fontSize: 34,
        align: "center",
        color: "#1f1a1e",
        x: 10,
        y: 6,
        w: 80,
        h: 0,
      },
      {
        id: uid("image"),
        type: "image",
        src: null,
        shape: "oval",
        x: (100 - photoW) / 2,
        y: photoY,
        w: photoW,
        h: photoH,
      },
      {
        id: uid("text"),
        type: "text",
        text: "Robert Bayne",
        placeholder: true,
        fontFamily: "display",
        fontSize: 30,
        align: "center",
        color: "#1f1a1e",
        x: 8,
        y: nameY,
        w: 84,
        h: 0,
      },
      {
        id: uid("text"),
        type: "text",
        text: "1971 – 2024",
        placeholder: true,
        fontFamily: "body",
        fontSize: 15,
        align: "center",
        color: "#4f434c",
        letterSpacing: 1,
        x: 20,
        y: nameY + 8,
        w: 60,
        h: 0,
      },
    ],
    trim,
  );
}

/**
 * Starter document for a template, laid out on `format`'s trim. A booklet is
 * a cover, a generic interior page repeated to fill, and a back page; a flat
 * product is its front, then (when it has one) its back.
 */
export function makeStarterDoc(
  template: Template,
  pageCount: number,
  format: ProductFormat = BOOKLET_FORMAT,
): DesignDoc {
  const { trim } = format;
  const pages: DesignPage[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    if (index === 0) {
      pages.push({
        id: uid("page"),
        elements:
          format.templatePages === 3
            ? adaptToTrim(coverElements(template), trim)
            : flatFrontElements(template, trim),
      });
    } else if (index === pageCount - 1) {
      pages.push({ id: uid("page"), elements: adaptToTrim(backPageElements(), trim) });
    } else {
      pages.push({ id: uid("page"), elements: adaptToTrim(interiorPageElements(), trim) });
    }
  }
  return { templateId: template.id, pages, trim };
}

/**
 * A booklet's template layout is exactly three authored pages: cover, one
 * middle page, and back. Per print-shop convention the middle page is the one
 * that repeats to fill whichever page-count option (4, 8, 12, …) the customer
 * picks, so authoring more than one of it would have nowhere to go in the
 * finished booklet — withPageCount() performs that expansion.
 *
 * Flat products author fewer (ProductFormat.templatePages): a card or a
 * bookmark is a front and a back, a board is only a front.
 */
export const TEMPLATE_PAGE_COUNT = 3;

/** Display names for a product's authored template pages, by index. */
export function templatePageLabels(count: TemplatePageCount = TEMPLATE_PAGE_COUNT): string[] {
  if (count === 1) return ["Front"];
  if (count === 2) return ["Front", "Back"];
  return ["Cover", "Middle", "Back"];
}

export function templatePageLabel(
  index: number,
  count: TemplatePageCount = TEMPLATE_PAGE_COUNT,
): string {
  return templatePageLabels(count)[index] ?? `Page ${index + 1}`;
}

/** The starting point for authoring a template that has no layout yet. */
export function makeTemplateLayout(
  template: Template,
  format: ProductFormat = BOOKLET_FORMAT,
): DesignPage[] {
  return makeStarterDoc(template, format.templatePages, format).pages;
}

/**
 * Coerce a stored layout to the product's authored structure. Layouts
 * authored before this structure existed can be any length, so the authoring
 * editor normalises on load rather than rejecting them: the first page is the
 * cover (or front), the last is the back, and for a booklet the first
 * interior page (when there is one) becomes the middle that repeats.
 */
export function toTemplateLayout(
  pages: DesignPage[] | null,
  templatePages: TemplatePageCount = TEMPLATE_PAGE_COUNT,
): DesignPage[] | null {
  if (!pages || pages.length === 0) return null;
  if (pages.length === templatePages) return pages;
  const back = pages.length >= 2 ? pages[pages.length - 1] : makeBlankPage();
  if (templatePages === 1) return [pages[0]];
  if (templatePages === 2) return [pages[0], back];
  return [pages[0], pages.length >= 3 ? pages[1] : makeBlankPage(), back];
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
 * reconciled to the requested length. `trim` is the template's product's —
 * a layout stores no size of its own.
 */
export function instantiateLayout(
  templateId: string,
  layout: DesignPage[],
  pageCount: number,
  trim: PageTrim = A5_TRIM,
): DesignDoc {
  const pages = layout.map(clonePageWithFreshIds);
  return withPageCount({ templateId, pages, trim }, pageCount);
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
