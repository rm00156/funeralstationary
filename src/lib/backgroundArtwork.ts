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

import { FULL_BLEED_BOX, uid, type ImageElement } from "@/lib/designEditor";
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
  | { kind: "url"; url: string };

/** Which part of the page the artwork leaves clear for text. */
export type TextZone = "top" | "bottom";

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
  /** Which zone compositions should put the name and dates in. */
  textZone: TextZone;
  /** Palettes to render a tinted variant for. */
  palettes: readonly PaletteId[];
}

export const DEFAULT_WASH = 0.32;
export const DEFAULT_TINT = 0.2;
export const DEFAULT_INSET = 0.05;

/**
 * Rendered assets are keyed deterministically so the generator can compute a
 * background's URL without an index file: object-storage key when S3 is
 * configured, otherwise the path under public/.
 */
export function backgroundAssetKey(id: string, palette: PaletteId): string {
  return `templates/backgrounds/${id}-${palette}.jpg`;
}

/**
 * The element a background becomes on a page: an image covering the whole
 * artboard (bleed included), locked so the customer can't move or delete it.
 * Must be the first element on the page so everything else draws above it.
 */
export function backgroundElement(src: string): ImageElement {
  return {
    id: uid("image"),
    type: "image",
    src,
    shape: "rect",
    locked: true,
    ...FULL_BLEED_BOX,
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
    fade: { edge: "bottom", start: 50, end: 76 },
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
    textZone: "bottom",
    palettes: ["plum", "slate", "bronze", "ink"],
  },
];

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
