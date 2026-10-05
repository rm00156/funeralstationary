/**
 * Background artwork: the raster images that sit behind a template as a
 * locked, full-bleed layer. This module is pure and DB-free (same discipline
 * as templateGenerator.ts) — it holds the curated manifest, the naming rule
 * for rendered assets, and the element builder the generator uses.
 *
 * The images themselves come from public-domain and free-licence sources
 * (see `BackgroundSourceRef`), are fetched, cropped, tinted per palette and
 * saved by `npm run backgrounds:fetch` (src/db/fetchBackgrounds.ts). Nothing
 * here downloads anything.
 */

import {
  A5_TRIM,
  FULL_BLEED_BOX,
  fullBleedBox,
  uid,
  type ImageElement,
  type PageTrim,
} from "@/lib/designEditor";
import type { PaletteId } from "@/lib/templateGenerator";

/** Where a source image comes from. Each kind maps to one fetch adapter. */
export type BackgroundSourceRef =
  /** Met Open Access — no key needed; only `isPublicDomain` objects are accepted. */
  | { kind: "met"; objectId: number }
  /** Wikimedia Commons file page title, e.g. "File:Rosa centifolia Burgundiaca.jpg". */
  | { kind: "commons"; file: string }
  /** Pexels photo id — needs PEXELS_API_KEY. Pexels licence: free commercial use, no attribution. */
  | { kind: "pexels"; photoId: number }
  /** Anything else — record the licence and credit by hand. */
  | { kind: "url"; url: string }
  /**
   * Draped satin, generated on the render canvas rather than sourced: there is
   * no public-domain photograph of plain satin worth printing. Own work, so no
   * licence question. `seed` fixes the folds, so a re-render is identical.
   */
  | { kind: "satin"; base: string; light: string; dark: string; seed: number };

/** Which part of the page the artwork leaves clear for text. */
export type TextZone = "top" | "bottom";

/**
 * The artboards a background is rendered for. Every A size shares A5's shape,
 * so one A5 render covers the booklet, the A6 cards and the board; a bookmark
 * is a quarter as wide as it is tall, and a cover crop of the A5 render would
 * keep a sliver of it, so a background opts in to its own bookmark render.
 */
export type BackgroundFormat = "a5" | "bookmark";

/** The trim each format is rendered at, bleed added. */
export const BACKGROUND_FORMAT_TRIMS: Record<BackgroundFormat, PageTrim> = {
  a5: A5_TRIM,
  bookmark: { widthMm: 50, heightMm: 200 },
};

/** The layout knobs a bookmark render may set differently; the rest carry over. */
export type BackgroundLayout = Pick<
  BackgroundSpec,
  "focus" | "placement" | "fade" | "radialFade" | "glow" | "shade"
>;

export interface BackgroundSpec {
  /** Slug; the asset filename and what template specs reference. Immutable. */
  id: string;
  name: string;
  source: BackgroundSourceRef;
  /** Licence record kept next to the image — CC0, "Public domain", "Pexels", ... */
  licence: string;
  /** Attribution line (artist, work, holder). */
  credit: string;
  /**
   * Anchor for the cover crop, as fractions of the source image. Where the
   * interest is: a tall flower on a plate wants ~0.5/0.35 so its head, not
   * its stem, survives the crop.
   */
  focus?: { x: number; y: number };
  /**
   * Fraction of the source trimmed from every side before cropping, so a
   * scan's mount, tape or plate edge never reaches the page. Default 0.05.
   */
  inset?: number;
  /**
   * The region of the artboard the artwork occupies, in percent; the rest is
   * paper. Omit for full-bleed.
   */
  placement?: { x: number; y: number; w: number; h: number };
  /** Soften the artwork's edges into the paper, in percent of the artboard width. */
  feather?: number;
  /**
   * Fade the artwork to paper radially around a point, for flowers tucked
   * into a corner: fully visible within `inner`, fully paper beyond `outer`.
   * The centre is in percent of the artboard (it may sit on or past an edge);
   * both radii are in percent of the artboard width. A straight feather on a
   * corner-placed photograph still reads as a pasted rectangle — this doesn't.
   */
  radialFade?: { cx: number; cy: number; inner: number; outer: number };
  /**
   * Fade the artwork into paper over the text zone. `start` is where the
   * artwork is still fully visible and `end` where it is fully paper, both in
   * percent of the artboard height — so for a bottom fade start < end, and
   * for a top fade start > end.
   */
  fade?: { edge: TextZone; start: number; end: number };
  /** How far to knock the artwork back toward paper, 0–1. Default 0.32. */
  wash?: number;
  /** How strongly to tint toward the palette accent, 0–1. Default 0.2. */
  tint?: number;
  /**
   * A colour washed in from the top edge, fully transparent by `end` percent
   * of the artboard height — the soft yellow or blush sky above a flower band.
   * Drawn last, over the paper the fade left, so it never muddies the flowers.
   */
  glow?: { color: string; end: number };
  /**
   * Darken a photograph toward its top and bottom edges so light type set on
   * it holds — the sky behind "Celebrating" and the land under the name.
   * Opacities 0–1 at each edge, easing to nothing by the middle of the page.
   */
  shade?: { color: string; top: number; bottom: number };
  /**
   * Also render for a bookmark (BackgroundFormat), with these overrides — a
   * flower band that is 44% of an A5 page would be 88mm of a bookmark.
   */
  bookmark?: BackgroundLayout;
  /**
   * Cut this specimen out of its ground as a transparent PNG, for use as a
   * corner or edge spray over a photo-led layout. Only suitable for a plate
   * on plain, even ground. `tolerance` is the RGB distance from the sampled
   * ground colour that still counts as background — raise it for a foxed or
   * mottled scan, lower it if pale petals start disappearing.
   */
  spray?: {
    tolerance: number;
    /**
     * Overrides `inset` for the cut only. A plate with a ruled border drawn on
     * it, or a dark mount edge, needs a deeper trim than the background crop
     * does: the border line is dark, so no tolerance removes it, and a dark
     * edge under the corner samplers teaches the fill the wrong ground colour
     * entirely.
     */
    inset?: number;
    /** Fraction of the plate's height dropped before cutting, to lose the engraved caption. */
    cropBottom?: number;
    /** Smallest enclosed ground pocket to clear, as a fraction of the image. 0 disables. */
    minEnclosedRegion?: number;
    /**
     * Largest stray opaque island to drop, as a fraction of the image — the
     * foxing specks and plate-edge slivers of a worn scan. Default 0 (off):
     * a plate with genuinely separate small parts (a fallen petal) needs it off.
     */
    minIsland?: number;
    /**
     * Redraw the cutout in a single colour — its shadows in this ink, its
     * highlights toward white — so a coloured study prints as the quiet
     * one-colour flourish a monochrome template wants.
     */
    monochrome?: string;
  };
  /** Which zone compositions should put the name and dates in. */
  textZone: TextZone;
  /** Palettes to render a tinted variant for. Empty for a plate used only as a cutout. */
  palettes: readonly PaletteId[];
}

export const DEFAULT_WASH = 0.32;
export const DEFAULT_TINT = 0.2;
export const DEFAULT_INSET = 0.05;
export const DEFAULT_SPRAY_CROP_BOTTOM = 0.1;
export const DEFAULT_SPRAY_MIN_ENCLOSED = 0.002;

/**
 * Rendered assets are keyed deterministically so the generator can compute a
 * background's URL without an index file: object-storage key when S3 is
 * configured, otherwise the path under public/.
 */
export function backgroundAssetKey(
  id: string,
  palette: PaletteId,
  format: BackgroundFormat = "a5",
): string {
  // The A5 key predates formats; every generated template references it.
  return format === "a5"
    ? `templates/backgrounds/${id}-${palette}.jpg`
    : `templates/backgrounds/${id}-${palette}-${format}.jpg`;
}

/** The formats a background is rendered for. */
export function backgroundFormats(spec: BackgroundSpec): BackgroundFormat[] {
  return spec.bookmark ? ["a5", "bookmark"] : ["a5"];
}

/** A background's layout knobs for one format: the bookmark overrides, else its own. */
export function backgroundLayout(spec: BackgroundSpec, format: BackgroundFormat): BackgroundLayout {
  const own: BackgroundLayout = {
    focus: spec.focus,
    placement: spec.placement,
    fade: spec.fade,
    radialFade: spec.radialFade,
    glow: spec.glow,
    shade: spec.shade,
  };
  return format === "bookmark" && spec.bookmark ? { ...own, ...spec.bookmark } : own;
}

/**
 * Sprays are **not** rendered per palette. A cutout keeps the specimen's own
 * colour — that's the whole point of it — and tinting a pink rose toward a
 * forest accent would just look wrong. Cohesion comes from curation instead:
 * pair a spray with palettes that suit it.
 */
export function sprayAssetKey(id: string): string {
  return `templates/sprays/${id}.png`;
}

/**
 * The element a background becomes on a page: an image covering the whole
 * artboard (bleed included), locked so the customer can't move or delete it.
 * Must be the first element on the page so everything else draws above it.
 */
export function backgroundElement(src: string, trim?: PageTrim): ImageElement {
  return {
    id: uid("image"),
    type: "image",
    src,
    shape: "rect",
    locked: true,
    ...(trim ? fullBleedBox(trim) : FULL_BLEED_BOX),
  };
}

/**
 * A cutout spray placed on the page. Locked like a background, but sized and
 * positioned by the composition rather than covering the artboard.
 */
export function sprayElement(
  src: string,
  box: { x: number; y: number; w: number; h: number },
  rotation?: number,
): ImageElement {
  return {
    id: uid("image"),
    type: "image",
    src,
    shape: "rect",
    // A cutout must never be cropped or stretched — its silhouette is the
    // artwork — so it fits inside its box rather than filling it.
    fit: "contain",
    locked: true,
    rotation,
    ...box,
  };
}

const BOTANICAL_PALETTES: readonly PaletteId[] = ["plum", "forest", "bronze", "stone"];

/**
 * The curated manifest. Every entry was checked against its source API
 * (object exists, has a high-resolution image, and is public domain). Add to
 * this list; never rename an id, since generated templates reference them.
 */
export const BACKGROUND_SPECS: readonly BackgroundSpec[] = [
  {
    id: "redoute-frankfort-rose",
    name: "Frankfort Rose",
    source: { kind: "met", objectId: 762055 },
    licence: "Public domain (Met Open Access, CC0)",
    credit: "Pierre-Joseph Redouté, ‘Empress Josephine’ or Frankfort Rose, from Les Roses. The Metropolitan Museum of Art.",
    focus: { x: 0.5, y: 0.35 },
    fade: { edge: "bottom", start: 52, end: 78 },
    spray: { tolerance: 40 },
    textZone: "bottom",
    palettes: BOTANICAL_PALETTES,
  },
  {
    id: "redoute-crown-imperial",
    name: "Crown Imperial",
    source: { kind: "met", objectId: 762064 },
    licence: "Public domain (Met Open Access, CC0)",
    credit: "Pierre-Joseph Redouté, Crown Imperial (Fritillaria imperialis), from Les Liliacées. The Metropolitan Museum of Art.",
    focus: { x: 0.5, y: 0.3 },
    fade: { edge: "bottom", start: 50, end: 78 },
    spray: { tolerance: 40 },
    textZone: "bottom",
    palettes: BOTANICAL_PALETTES,
  },
  {
    id: "redoute-climbing-lily",
    name: "Climbing Lily",
    source: { kind: "met", objectId: 697703 },
    licence: "Public domain (Met Open Access, CC0)",
    credit: "Pierre-Joseph Redouté, Gloriosa Superba (Climbing Lily). The Metropolitan Museum of Art.",
    focus: { x: 0.5, y: 0.35 },
    fade: { edge: "bottom", start: 52, end: 78 },
    // Dark plate edge under the corner samplers, so the cut needs a deeper trim.
    spray: { tolerance: 45, inset: 0.12 },
    textZone: "bottom",
    palettes: BOTANICAL_PALETTES,
  },
  {
    id: "redoute-erica",
    name: "Heath in Flower",
    source: { kind: "met", objectId: 697702 },
    licence: "Public domain (Met Open Access, CC0)",
    credit: "Pierre-Joseph Redouté, Erica Fulgida. The Metropolitan Museum of Art.",
    focus: { x: 0.5, y: 0.4 },
    fade: { edge: "bottom", start: 52, end: 78 },
    // Ruled border drawn on the plate; no tolerance removes a dark line.
    spray: { tolerance: 45, inset: 0.12 },
    textZone: "bottom",
    palettes: BOTANICAL_PALETTES,
  },
  {
    id: "redoute-burgundy-rose",
    name: "Burgundy Rose",
    source: { kind: "commons", file: "File:Rosa centifolia Burgundiaca.jpg" },
    licence: "Public domain",
    credit: "Pierre-Joseph Redouté, Rosa centifolia Burgundiaca, from Les Roses. Via Wikimedia Commons.",
    focus: { x: 0.5, y: 0.35 },
    fade: { edge: "bottom", start: 52, end: 78 },
    spray: { tolerance: 38 },
    textZone: "bottom",
    palettes: BOTANICAL_PALETTES,
  },
  {
    id: "redoute-cabbage-rose",
    name: "Cabbage Rose",
    source: { kind: "commons", file: "File:Redoute - Rosa centifolia foliacea.jpg" },
    licence: "Public domain",
    credit: "Pierre-Joseph Redouté, Rosa centifolia foliacea, from Les Roses. Via Wikimedia Commons.",
    focus: { x: 0.5, y: 0.35 },
    fade: { edge: "bottom", start: 52, end: 78 },
    spray: { tolerance: 38 },
    textZone: "bottom",
    palettes: BOTANICAL_PALETTES,
  },
  {
    id: "redoute-madonna-lily",
    name: "Madonna Lily",
    source: { kind: "commons", file: "File:Lilium candidum in Les liliacees.jpg" },
    licence: "Public domain",
    credit: "Pierre-Joseph Redouté, Lilium candidum (Lis Blanc), from Les Liliacées. Via Wikimedia Commons.",
    // Bloom sits in the upper third; the plate's engraved caption at ~92% is
    // covered by the fade's solid-paper zone below `end`.
    focus: { x: 0.5, y: 0.28 },
    fade: { edge: "bottom", start: 42, end: 72 },
    // Knocked well back: this sits behind a photograph, not instead of one.
    wash: 0.55,
    // No spray: white petals on cream ground are too close to separate, and
    // this scan's canvas weave survives any tolerance loose enough to work.
    textZone: "bottom",
    palettes: ["stone", "bronze", "forest", "slate"],
  },
  {
    id: "redoute-martagon-lily",
    name: "Martagon Lily",
    source: { kind: "commons", file: "File:Lilium martagon - Les liliacées, vol. 3 - t. 146.jpg" },
    licence: "Public domain",
    credit: "Pierre-Joseph Redouté, Lilium martagon (Lis Martagon), from Les Liliacées. Via Wikimedia Commons.",
    focus: { x: 0.5, y: 0.32 },
    fade: { edge: "bottom", start: 52, end: 78 },
    spray: { tolerance: 42 },
    textZone: "bottom",
    palettes: ["plum", "slate", "bronze", "ink"],
  },

  // Photographic flower bands and corners. These are what the competitor
  // catalogue leans on most: real flowers along the foot of a white page, the
  // photograph and type in the clear space above. Commons-hosted CC0 imports
  // from Unsplash, Pixabay and Flickr; placed untinted and unwashed, since a
  // photograph's own colour is the point of it.
  {
    id: "crocus-meadow",
    name: "Crocus Meadow",
    source: { kind: "commons", file: "File:Purple crocuses in grass (Unsplash).jpg" },
    licence: "CC0",
    credit: "Purple crocuses in grass, via Unsplash. Via Wikimedia Commons.",
    placement: { x: 0, y: 56, w: 100, h: 44 },
    // Low in the frame: the flowers, not the blurred grass behind them.
    focus: { x: 0.5, y: 0.8 },
    fade: { edge: "top", start: 72, end: 58 },
    wash: 0,
    tint: 0,
    bookmark: {
      placement: { x: 0, y: 64, w: 100, h: 36 },
      fade: { edge: "top", start: 76, end: 64 },
    },
    textZone: "top",
    palettes: ["violet"],
  },
  {
    id: "white-blossom",
    name: "White Blossom",
    source: { kind: "commons", file: "File:White blossom branches (Unsplash).jpg" },
    licence: "CC0",
    credit: "White blossom branches, via Unsplash. Via Wikimedia Commons.",
    placement: { x: 0, y: 54, w: 100, h: 46 },
    focus: { x: 0.5, y: 0.6 },
    fade: { edge: "top", start: 70, end: 55 },
    wash: 0,
    tint: 0,
    glow: { color: "#f3df93", end: 46 },
    textZone: "top",
    palettes: ["bronze"],
  },
  {
    id: "pastel-rose-band",
    name: "Pastel Rose Band",
    source: { kind: "commons", file: "File:Pastel pink roses (Unsplash).jpg" },
    licence: "CC0",
    credit: "Pastel pink roses, via Unsplash. Via Wikimedia Commons.",
    placement: { x: 0, y: 58, w: 100, h: 42 },
    focus: { x: 0.4, y: 0.9 },
    fade: { edge: "top", start: 74, end: 58 },
    // Kept soft: this is the quiet one of the family, petals as a blush.
    wash: 0.25,
    tint: 0,
    bookmark: {
      placement: { x: 0, y: 64, w: 100, h: 36 },
      fade: { edge: "top", start: 76, end: 64 },
    },
    textZone: "top",
    palettes: ["rose"],
  },
  {
    id: "pastel-rose-corner",
    name: "Pastel Rose Corner",
    source: { kind: "commons", file: "File:Roses in pastel pink (Unsplash).jpg" },
    licence: "CC0",
    credit: "Roses in pastel pink, via Unsplash. Via Wikimedia Commons.",
    placement: { x: 22, y: 44, w: 84, h: 62 },
    focus: { x: 0.5, y: 0.5 },
    radialFade: { cx: 100, cy: 100, inner: 30, outer: 72 },
    wash: 0,
    tint: 0,
    glow: { color: "#efbfcf", end: 44 },
    textZone: "top",
    palettes: ["rose"],
  },
  {
    id: "red-petal-band",
    name: "Red Petal Band",
    source: { kind: "commons", file: "File:Flower Power (Unsplash).jpg" },
    licence: "CC0",
    credit: "Flower Power, via Unsplash. Via Wikimedia Commons.",
    placement: { x: 0, y: 60, w: 100, h: 40 },
    focus: { x: 0.5, y: 0.6 },
    fade: { edge: "top", start: 74, end: 60 },
    wash: 0,
    tint: 0,
    glow: { color: "#f5d2d8", end: 40 },
    textZone: "top",
    palettes: ["ink"],
  },
  {
    id: "rose-bush-band",
    name: "Rose Bush Band",
    source: { kind: "commons", file: "File:Spring Rose Bush (Unsplash).jpg" },
    licence: "CC0",
    credit: "Spring Rose Bush, via Unsplash. Via Wikimedia Commons.",
    placement: { x: 0, y: 58, w: 100, h: 42 },
    focus: { x: 0.5, y: 0.5 },
    fade: { edge: "top", start: 72, end: 58 },
    wash: 0,
    tint: 0,
    textZone: "top",
    palettes: ["wine"],
  },
  {
    id: "white-rose-corner",
    name: "White Rose Corner",
    source: { kind: "commons", file: "File:White Rose (18923655755).jpg" },
    licence: "CC0",
    credit: "White Rose, via Flickr. Via Wikimedia Commons.",
    placement: { x: 26, y: 48, w: 80, h: 58 },
    focus: { x: 0.5, y: 0.5 },
    radialFade: { cx: 100, cy: 100, inner: 26, outer: 66 },
    wash: 0,
    tint: 0,
    textZone: "top",
    palettes: ["violet"],
  },
  {
    id: "sky-blossom",
    name: "Blossom and Sky",
    source: { kind: "commons", file: "File:Sky-rose.jpg" },
    licence: "CC0",
    credit: "Sky-rose. Via Wikimedia Commons.",
    focus: { x: 0.5, y: 0.5 },
    // Type sits directly on this one, so it is washed further back than the bands.
    wash: 0.58,
    tint: 0,
    textZone: "top",
    palettes: ["rose"],
  },
  {
    id: "royal-satin",
    name: "Royal Blue Satin",
    source: { kind: "satin", base: "#264a94", light: "#6d93d8", dark: "#0f1f4a", seed: 7 },
    licence: "Own work (generated)",
    credit: "Generated satin, The Funeral Stationery.",
    wash: 0,
    tint: 0,
    textZone: "top",
    palettes: ["blue"],
  },
  // Watercolour studies for cutout corner sprays. CC0 museum scans (the
  // Rijksmuseum and the Met), on clean grounds that cut well.
  {
    id: "rijks-bouquet",
    name: "Bouquet with Morning Glory",
    source: { kind: "commons", file: "File:Een boeket Boeket, RP-T-FM-73.jpg" },
    licence: "CC0 (Rijksmuseum)",
    credit: "Een boeket, RP-T-FM-73. Rijksmuseum, Amsterdam. Via Wikimedia Commons.",
    // The tolerance stays low and enclosed pockets are left alone: the pale
    // rose touches the ground through its highlights, so anything looser cuts
    // it. The foxing and plate edge that leaves behind go as islands instead.
    spray: { tolerance: 34, inset: 0.07, minEnclosedRegion: 0, minIsland: 0.015 },
    textZone: "bottom",
    palettes: ["blue"],
  },
  {
    id: "sebastiana-sprig",
    name: "Sebastiana Sprig",
    source: {
      kind: "commons",
      file: "File:Study of a Plant with Red-Purple Flowers (Sebastiana africana purpurea) MET DP830841.jpg",
    },
    licence: "Public domain (Met Open Access, CC0)",
    credit: "Study of a Plant with Red-Purple Flowers (Sebastiana africana purpurea). The Metropolitan Museum of Art. Via Wikimedia Commons.",
    // Recoloured to one blue-grey ink: the quiet, damask-like corner flourish.
    spray: { tolerance: 42, monochrome: "#33506b" },
    textZone: "bottom",
    palettes: ["slate"],
  },
  {
    id: "wild-rose-sprig",
    name: "Wild Rose Sprig",
    source: { kind: "commons", file: "File:Takje wilde rozen, RP-T-1943-81.jpg" },
    licence: "CC0 (Rijksmuseum)",
    credit: "Takje wilde rozen, RP-T-1943-81. Rijksmuseum, Amsterdam. Via Wikimedia Commons.",
    spray: { tolerance: 36 },
    textZone: "bottom",
    palettes: ["forest"],
  },

  // Photographic scenes for the memorial card and bookmark: a landscape
  // across the whole page with the portrait and light type set straight onto
  // it. Untinted and unwashed — the picture is the point — but shaded toward
  // the top and bottom edges so white type holds on a pale sky. Each also
  // renders tall for the bookmark, cropped on `focus` (the sun, the rainbow,
  // the engine), since a centre strip of a landscape loses its subject.
  scene("lake-sunset", "Lake at Sunset", "File:Gander Bay lake sunset. (Unsplash).jpg",
    "Gander Bay lake sunset, via Unsplash. Via Wikimedia Commons.",
    { x: 0.6, y: 0.5 }, { top: 0.25, bottom: 0.3 }),
  scene("twilight-lake", "Twilight Lake", "File:Twilight lake sunset. (Unsplash).jpg",
    "Twilight lake sunset, via Unsplash. Via Wikimedia Commons.",
    { x: 0.42, y: 0.5 }, { top: 0.3, bottom: 0.5 }),
  scene("lake-jetty", "Lakeside Jetty", "File:Peaceful lake sunset. (Unsplash).jpg",
    "Peaceful lake sunset, via Unsplash. Via Wikimedia Commons.",
    { x: 0.5, y: 0.5 }, { top: 0.3, bottom: 0.5 }),
  scene("countryside-sunset", "Countryside Sunset", "File:Countryside sunset (Unsplash).jpg",
    "Countryside sunset, via Unsplash. Via Wikimedia Commons.",
    { x: 0.5, y: 0.5 }, { top: 0.3, bottom: 0.5 }),
  scene("country-dawn", "Dawn in the Country", "File:Dawn In The Country (Unsplash).jpg",
    "Dawn In The Country, via Unsplash. Via Wikimedia Commons.",
    { x: 0.62, y: 0.5 }, { top: 0.35, bottom: 0.5 }),
  scene("hay-bales", "Harvest Evening", "File:Bourdeilles pastures sunset (Unsplash).jpg",
    "Bourdeilles pastures sunset, via Unsplash. Via Wikimedia Commons.",
    { x: 0.72, y: 0.5 }, { top: 0.3, bottom: 0.5 }),
  scene("wheat-sunset", "Wheat at Sunset", "File:Wheat field sunset (Unsplash).jpg",
    "Wheat field sunset, via Unsplash. Via Wikimedia Commons.",
    { x: 0.3, y: 0.5 }, { top: 0.3, bottom: 0.5 }),
  scene("rainbow-meadow", "Rainbow Meadow", "File:Desna meadows rainbow.JPG",
    "Desna meadows rainbow, by Аимаина хикари. Via Wikimedia Commons.",
    { x: 0.84, y: 0.5 }, { top: 0.3, bottom: 0.55 }),
  scene("steam-viaduct", "Steam Railway", 'File:Talyllyn Railway No. 6 "Douglas" on the Dolgoch Viaduct - April 2019.jpg',
    "Talyllyn Railway No. 6 on the Dolgoch Viaduct, by William Davies. Via Wikimedia Commons.",
    // The bookmark's narrow strip moves right, onto the engine and carriages.
    { x: 0.32, y: 0.5 }, { top: 0.35, bottom: 0.55 }, { x: 0.62, y: 0.5 }),
  scene("beach-sunset", "Beach at Sunset", "File:Sunset over the beach (Unsplash).jpg",
    "Sunset over the beach, via Unsplash. Via Wikimedia Commons.",
    { x: 0.78, y: 0.5 }, { top: 0.25, bottom: 0.45 }),

  // Two more flower bands, rendered for the bookmark as well.
  {
    id: "sunflower-band",
    name: "Sunflower Band",
    source: { kind: "commons", file: "File:Impressive sunflowers (Unsplash).jpg" },
    licence: "CC0",
    credit: "Impressive sunflowers, via Unsplash. Via Wikimedia Commons.",
    placement: { x: 0, y: 58, w: 100, h: 42 },
    focus: { x: 0.45, y: 0.6 },
    fade: { edge: "top", start: 72, end: 58 },
    wash: 0,
    tint: 0,
    glow: { color: "#f6e7a8", end: 40 },
    bookmark: {
      placement: { x: 0, y: 66, w: 100, h: 34 },
      focus: { x: 0.55, y: 0.6 },
      fade: { edge: "top", start: 76, end: 66 },
      glow: { color: "#f6e7a8", end: 30 },
    },
    textZone: "top",
    palettes: ["bronze"],
  },
  {
    id: "poppy-band",
    name: "Poppy Band",
    source: { kind: "commons", file: "File:Poppies (Unsplash).jpg" },
    licence: "CC0",
    credit: "Poppies, via Unsplash. Via Wikimedia Commons.",
    // Zoomed in and anchored on the bottom edge: the poppies fill only the
    // lower part of the frame, and the hazy sky above them reads as a grey
    // smear on white paper unless it's cropped away and faded out long.
    inset: 0.12,
    placement: { x: 0, y: 46, w: 100, h: 54 },
    focus: { x: 0.5, y: 1 },
    fade: { edge: "top", start: 76, end: 52 },
    wash: 0,
    tint: 0,
    bookmark: {
      placement: { x: 0, y: 60, w: 100, h: 40 },
      focus: { x: 0.45, y: 1 },
      fade: { edge: "top", start: 74, end: 60 },
    },
    textZone: "top",
    palettes: ["wine"],
  },

  // Cutouts for the memorial cards and bookmarks — sprays only, so no
  // palette variants are rendered.
  cutout("redoute-daffodil", "Daffodil",
    { kind: "commons", file: "File:Narcissus pseudonarcissus - Les liliacées - vol. 3 - t. 158 - clean.jpg" },
    "Public domain",
    "Pierre-Joseph Redouté, Narcissus pseudonarcissus, from Les Liliacées. Via Wikimedia Commons.",
    // Cropped above the bulb and roots; the dissected flower beside it is an island.
    { tolerance: 38, cropBottom: 0.24, minIsland: 0.01 }),
  cutout("flora-batava-bluebell", "Bluebell",
    { kind: "commons", file: "File:Hyacinthus non-scriptus — Flora Batava — Volume v1.jpg" },
    "Public domain",
    "Jan Kops, Hyacinthus non-scriptus, from Flora Batava. Via Wikimedia Commons.",
    // Trimmed past the torn sheet edge at top left.
    { tolerance: 40, inset: 0.08, cropBottom: 0.3, minIsland: 0.02 }),
  cutout("thome-thistle", "Thistle",
    { kind: "commons", file: "File:Illustration Carduus nutans0 white.jpg" },
    "Public domain",
    "Otto Wilhelm Thomé, Carduus nutans, from Flora von Deutschland, Österreich und der Schweiz. Via Wikimedia Commons.",
    // The ground pockets between the spines are small, so clear them small.
    { tolerance: 30, minEnclosedRegion: 0.0002, minIsland: 0.02 }),
  cutout("rijks-blue-butterfly", "Blue Butterfly",
    { kind: "commons", file: "File:Boven- en onderaanzicht van een vlinder, RP-T-FM-105.jpg" },
    "CC0 (Rijksmuseum)",
    "Boven- en onderaanzicht van een vlinder, RP-T-FM-105. Rijksmuseum, Amsterdam. Via Wikimedia Commons.",
    // The upper view only: the underside below it is cropped away.
    { tolerance: 36, inset: 0.08, cropBottom: 0.5, minIsland: 0.005 }),
  cutout("sydney-robin", "Scarlet Robin",
    { kind: "commons", file: "File:SLNSW 823075 f24 Scarlet Robin Petroica multicolor.jpg" },
    "Public domain",
    "Sydney Bird Painter, Scarlet Robin. State Library of New South Wales. Via Wikimedia Commons.",
    { tolerance: 36, minIsland: 0.003 }),
  cutout("rijks-quince-branch", "Flowering Branch",
    { kind: "commons", file: "File:Bloeiende tak Japanse kers, RP-T-1954-262.jpg" },
    "CC0 (Rijksmuseum)",
    "Bloeiende tak Japanse kers, RP-T-1954-262. Rijksmuseum, Amsterdam. Via Wikimedia Commons.",
    { tolerance: 36, minIsland: 0.003 }),
  cutout("american-flora-poppy", "Corn Poppy",
    { kind: "commons", file: "File:The American Flora. Vol. 1, 1855 - pl. 17 Papaver rhoeas (6022329916).jpg" },
    "Public domain",
    "Papaver rhoeas, plate 17 of The American Flora, vol. 1 (1855). Biodiversity Heritage Library. Via Wikimedia Commons.",
    { tolerance: 40, cropBottom: 0.12, minIsland: 0.005 }),
  cutout("ishizaki-sunflower", "Sunflower Study",
    {
      kind: "commons",
      file: "File:Naturalis Biodiversity Center - RMNH.ART.746 - Helianthus annuus - Yūshi Ishizaki - Cock Blomhoff Collection - pencil drawing - water colour.jpg",
    },
    "Public domain",
    "Ishizaki Yūshi, Helianthus annuus. Naturalis Biodiversity Center. Via Wikimedia Commons.",
    // The name labels above the flower go as islands.
    { tolerance: 36, cropBottom: 0.04, minIsland: 0.01 }),
  cutout("rijks-lily-butterflies", "Lily and Butterflies",
    { kind: "commons", file: "File:Twee vlinders bij een lelie, RP-T-1957-339.jpg" },
    "CC0 (Rijksmuseum)",
    "Twee vlinders bij een lelie, RP-T-1957-339. Rijksmuseum, Amsterdam. Via Wikimedia Commons.",
    // A ruled border inside the sheet: trimmed past it.
    { tolerance: 36, inset: 0.09, minIsland: 0.003 }),
];

/** A full-bleed photographic scene, rendered for the A5 page and the bookmark. */
function scene(
  id: string,
  name: string,
  file: string,
  credit: string,
  focus: { x: number; y: number },
  shade: { top: number; bottom: number },
  bookmarkFocus?: { x: number; y: number },
): BackgroundSpec {
  return {
    id,
    name,
    source: { kind: "commons", file },
    licence: "CC0",
    credit,
    focus,
    inset: 0,
    wash: 0,
    tint: 0,
    shade: { color: "#0d0b10", ...shade },
    bookmark: bookmarkFocus ? { focus: bookmarkFocus } : {},
    textZone: "top",
    palettes: ["ink"],
  };
}

/** A plate used only as a cutout spray: no palette variants to render. */
function cutout(
  id: string,
  name: string,
  source: BackgroundSourceRef,
  licence: string,
  credit: string,
  spray: NonNullable<BackgroundSpec["spray"]>,
): BackgroundSpec {
  return { id, name, source, licence, credit, spray, textZone: "bottom", palettes: [] };
}

export function getBackgroundSpec(id: string): BackgroundSpec | undefined {
  return BACKGROUND_SPECS.find((spec) => spec.id === id);
}

/** One line of the licence/attribution record. */
export interface BackgroundCredit {
  id: string;
  name: string;
  licence: string;
  credit: string;
  /** Source page the image came from; empty until that background is fetched. */
  sourceUrl: string;
}

/**
 * The credits record for the whole manifest, given whatever a run resolved.
 *
 * Always emitted for every BACKGROUND_SPECS entry in manifest order, so a
 * partial run (`--only=...`) can't shrink the attribution record to just the
 * backgrounds it touched — this is a licence record, it has to describe the
 * whole catalogue. Entries for ids no longer in the manifest are dropped, and
 * a `sourceUrl` recorded by an earlier run survives one that didn't resolve it.
 */
export function mergeCredits(
  existing: readonly BackgroundCredit[],
  resolved: readonly BackgroundCredit[],
): BackgroundCredit[] {
  const previous = new Map(existing.map((entry) => [entry.id, entry]));
  const fresh = new Map(resolved.map((entry) => [entry.id, entry]));
  return BACKGROUND_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    licence: spec.licence,
    credit: spec.credit,
    sourceUrl: fresh.get(spec.id)?.sourceUrl || previous.get(spec.id)?.sourceUrl || "",
  }));
}
