/**
 * Bulk template authoring: composes the cover/middle/back triple a template
 * layout needs (TEMPLATE_PAGE_COUNT) out of an *archetype* — the composition,
 * which is what makes two templates look genuinely different — and a *style*
 * — the palette, type pairing and motif layered over it.
 *
 * Splitting it this way is deliberate. Generating every palette x type x motif
 * combination of a single layout produces a catalogue that reads as one design
 * recoloured N times; varying the composition too is what makes the results
 * look designed rather than stamped. Curate combinations in TEMPLATE_SPECS
 * rather than taking the full cartesian product.
 *
 * Kept DB-free and side-effect-free so it unit-tests without a database —
 * the same discipline as seedData.ts. The runner that writes these into the
 * catalogue is src/db/generateTemplates.ts.
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
import {
  backgroundElement,
  getBackgroundSpec,
  sprayElement,
  type TextZone,
} from "@/lib/backgroundArtwork";
import { FULL_BLEED_BOX } from "@/lib/designEditor";

/**
 * Element coordinates are percentages of a page that is taller than it is
 * wide, so a box is only square on the printed page when its height percentage
 * is scaled by the page's aspect ratio. Round photos need this or they print
 * as ovals.
 */
const squareH = (w: number) => (w * PAGE_W_MM) / PAGE_H_MM;

/** The venue and time block, in whichever ink the ground calls for. */
const serviceDetails = (
  style: TemplateStyle,
  y: number,
  color = style.muted,
): CanvasElement =>
  text({
    text: PLACEHOLDER_SERVICE,
    fontFamily: style.body,
    fontSize: 11,
    align: "center",
    color,
    x: 18,
    y,
    w: 64,
    h: 0,
  });

const text = (props: Omit<TextElement, "id" | "type">): CanvasElement => ({
  id: uid("text"),
  type: "text",
  ...props,
});

const photo = (props: Omit<ImageElement, "id" | "type" | "src">): CanvasElement => ({
  id: uid("image"),
  type: "image",
  src: null,
  ...props,
});

const rule = (props: Omit<ShapeElement, "id" | "type" | "shape">): CanvasElement => ({
  id: uid("shape"),
  type: "shape",
  shape: "line",
  ...props,
});

const motif = (props: Omit<ClipartElement, "id" | "type">): CanvasElement => ({
  id: uid("clipart"),
  type: "clipart",
  ...props,
});

const border = (props: Omit<FrameElement, "id" | "type">): CanvasElement => ({
  id: uid("frame"),
  type: "frame",
  ...props,
});

/** Everything an archetype needs to colour and typeset itself. */
export interface TemplateStyle {
  /** Decorative colour: frames, rules, motifs. */
  accent: string;
  /** Primary text colour, used for the name and page titles. */
  ink: string;
  /** Supporting text colour, used for dates and prose. */
  muted: string;
  /** Paper tone behind every page. */
  paper: string;
  /** Face for the deceased's name and page titles. */
  heading: FontFamilyId;
  /** Face for the running order and prose. */
  body: FontFamilyId;
  /** Face for the "Celebrating the life of" flourish. */
  script: FontFamilyId;
  /** Clipart id used as the recurring motif. */
  icon: string;
}

/**
 * Muted palettes drawn from INK_PALETTE / PAGE_BACKGROUND_PALETTE — staying
 * inside those keeps generated templates consistent with what the editor's
 * own colour pickers offer, so an admin editing one afterwards finds the
 * same swatches.
 */
export const TEMPLATE_PALETTES = {
  plum: { accent: "#6b2d6a", ink: "#1f1a1e", muted: "#4f434c", paper: "#faf6ef" },
  forest: { accent: "#226b3d", ink: "#1f1a1e", muted: "#4f434c", paper: "#eef0ea" },
  slate: { accent: "#33506b", ink: "#1f1a1e", muted: "#4f434c", paper: "#f2ede9" },
  bronze: { accent: "#5b4a2f", ink: "#1f1a1e", muted: "#4f434c", paper: "#faf6ef" },
  ink: { accent: "#1f1a1e", ink: "#1f1a1e", muted: "#4f434c", paper: "#ffffff" },
  stone: { accent: "#81737d", ink: "#1f1a1e", muted: "#4f434c", paper: "#f4f1ee" },
} as const satisfies Record<string, Omit<TemplateStyle, "heading" | "body" | "script" | "icon">>;

export type PaletteId = keyof typeof TEMPLATE_PALETTES;

/** Heading / body / script pairings, each a coherent voice rather than a random draw. */
export const TEMPLATE_TYPE_SETS = {
  classic: { heading: "marcellus", body: "lato", script: "pinyonScript" },
  garamond: { heading: "ebGaramond", body: "karla", script: "parisienne" },
  playfair: { heading: "playfair", body: "inter", script: "allura" },
  cormorant: { heading: "cormorant", body: "mulish", script: "petitFormalScript" },
  baskerville: { heading: "libreBaskerville", body: "nunitoSans", script: "sacramento" },
  prata: { heading: "prata", body: "raleway", script: "italianno" },
} as const satisfies Record<string, Pick<TemplateStyle, "heading" | "body" | "script">>;

export type TypeSetId = keyof typeof TEMPLATE_TYPE_SETS;

/** Placeholder copy — an admin or customer replaces these on their own document. */
const PLACEHOLDER_NAME = "Robert Bayne";
const PLACEHOLDER_DATES = "1971 – 2024";
const RUNNING_ORDER =
  "Opening Music\n\nWelcome & Introduction\n\nHymn — Abide With Me\n\nEulogy\n\nReading\n\nPrayers\n\nClosing Words";
const FAREWELL = "Forever in our hearts";
/**
 * Where and when the service is. Every competitor cover carries this under
 * the dates — it's the practical reason a mourner keeps the card in a pocket
 * — so no cover should ship without a slot for it.
 */
const PLACEHOLDER_SERVICE = "Reading Crematorium\nTuesday 16th June 2026, 11am";
const THANKS =
  "The family would like to thank you\nfor your kindness, support and\npresence here today.";

/**
 * Cover compositions. Each is a distinct arrangement — a different frame
 * treatment, photo shape and vertical rhythm — so the generated previews are
 * visually separable at thumbnail size, which is where customers pick.
 */
const COVERS: Record<string, (style: TemplateStyle) => CanvasElement[]> = {
  /** House classic: triple border, script overline, round portrait. */
  framed: (s) => [
    border({ variant: "triple", color: s.accent, x: 4, y: 3, w: 92, h: 94 }),
    text({
      text: "Celebrating",
      fontFamily: s.script,
      fontSize: 44,
      align: "center",
      color: s.ink,
      x: 10,
      y: 9,
      w: 80,
      h: 0,
    }),
    text({
      text: "the life of",
      fontFamily: s.body,
      fontSize: 12,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 3,
      x: 15,
      y: 20.5,
      w: 70,
      h: 0,
    }),
    photo({ shape: "oval", x: 30, y: 27, w: 40, h: squareH(40) }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 30,
      align: "center",
      color: s.ink,
      uppercase: true,
      letterSpacing: 1.5,
      x: 8,
      y: 61,
      w: 84,
      h: 0,
    }),
    rule({ color: s.accent, strokeWidth: 1, x: 38, y: 69.5, w: 24, h: 0.4 }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 14,
      align: "center",
      color: s.muted,
      x: 20,
      y: 73,
      w: 60,
      h: 0,
    }),
  ],

  /** Photo-led: a large portrait-orientation photo dominates, no border. */
  portrait: (s) => [
    photo({ x: 22, y: 8, w: 56, h: 46 }),
    text({
      text: "in loving memory of",
      fontFamily: s.body,
      fontSize: 11,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 58,
      w: 70,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 32,
      align: "center",
      color: s.ink,
      x: 8,
      y: 62.5,
      w: 84,
      h: 0,
    }),
    rule({ color: s.accent, strokeWidth: 1, x: 35, y: 72, w: 30, h: 0.4 }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 14,
      align: "center",
      color: s.muted,
      x: 20,
      y: 75.5,
      w: 60,
      h: 0,
    }),
    motif({ icon: s.icon, color: s.accent, x: 45, y: 85, w: 10, h: squareH(10) }),
  ],

  /** Airy and typographic: hairline rules, a small portrait, lots of paper. */
  minimal: (s) => [
    rule({ color: s.accent, strokeWidth: 1, x: 20, y: 11, w: 60, h: 0.3 }),
    text({
      text: "in memory",
      fontFamily: s.body,
      fontSize: 11,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 15,
      w: 70,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 34,
      align: "center",
      color: s.ink,
      x: 8,
      y: 20,
      w: 84,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      x: 20,
      y: 30,
      w: 60,
      h: 0,
    }),
    photo({ shape: "oval", x: 31, y: 40, w: 38, h: squareH(38) }),
    // Bottom rule and motif sit low enough to balance the 11% top margin —
    // otherwise the whole composition floats into the upper two-thirds.
    rule({ color: s.accent, strokeWidth: 1, x: 20, y: 78, w: 60, h: 0.3 }),
    motif({ icon: s.icon, color: s.muted, x: 47, y: 83.5, w: 6, h: squareH(6) }),
  ],

  /** Formal: double border, motif crown, portrait photo in an arch window. */
  arch: (s) => [
    border({ variant: "double", color: s.accent, x: 6, y: 5, w: 88, h: 90 }),
    motif({ icon: s.icon, color: s.accent, x: 44, y: 11, w: 12, h: squareH(12) }),
    text({
      text: "In loving memory of",
      fontFamily: s.script,
      fontSize: 32,
      align: "center",
      color: s.ink,
      x: 10,
      y: 21,
      w: 80,
      h: 0,
    }),
    // Portrait window, taller than its semicircle radius so the straight
    // sides read as an arch rather than an oval.
    photo({ shape: "arch", x: 32, y: 28, w: 36, h: 31 }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 28,
      align: "center",
      color: s.ink,
      uppercase: true,
      letterSpacing: 1.5,
      x: 8,
      y: 63,
      w: 84,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      x: 20,
      y: 72,
      w: 60,
      h: 0,
    }),
  ],

  /**
   * Motifs at the corners instead of a border, with a square photo. Only a
   * diagonal pair, not all four: clipart has no flip or rotate, so four copies
   * all face the same way and read as cloned rather than as an ornament.
   */
  corners: (s) => [
    motif({ icon: s.icon, color: s.accent, x: 8, y: 7, w: 10, h: squareH(10) }),
    motif({ icon: s.icon, color: s.accent, x: 82, y: 85.9, w: 10, h: squareH(10) }),
    text({
      text: "Celebrating the life of",
      fontFamily: s.script,
      fontSize: 30,
      align: "center",
      color: s.ink,
      x: 10,
      y: 15,
      w: 80,
      h: 0,
    }),
    photo({ x: 26, y: 26, w: 48, h: squareH(48) }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 30,
      align: "center",
      color: s.ink,
      x: 8,
      y: 63,
      w: 84,
      h: 0,
    }),
    rule({ color: s.accent, strokeWidth: 1, x: 35, y: 72, w: 30, h: 0.4 }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      x: 20,
      y: 75.5,
      w: 60,
      h: 0,
    }),
  ],
};

export type ArchetypeId = keyof typeof COVERS;

export const ARCHETYPE_IDS = Object.keys(COVERS) as ArchetypeId[];

/**
 * Solid-ground compositions. No sourced artwork at all: a deep field of the
 * palette's accent, the photograph, and light type over it. A large part of
 * what the market actually sells is exactly this — a colour block and a
 * portrait — and it costs nothing to generate, so it isn't gated on a plate
 * being cuttable.
 *
 * Text is set in `paper` because the ground is `accent`; only palettes whose
 * accent is genuinely deep should be curated onto these.
 */
const SOLID_COVERS: Record<string, (style: TemplateStyle) => CanvasElement[]> = {
  /** Photograph bleeding off the top edge, colour block beneath carrying the type. */
  "solid-block": (s) => [
    {
      ...photo({ x: 0, y: 0, w: 0, h: 0 }),
      x: FULL_BLEED_BOX.x,
      y: FULL_BLEED_BOX.y,
      w: FULL_BLEED_BOX.w,
      h: 62 - FULL_BLEED_BOX.y,
    } as CanvasElement,
    rule({ color: s.paper, strokeWidth: 1, x: 10, y: 67, w: 80, h: 0.3 }),
    text({
      text: "In loving memory of",
      fontFamily: s.body,
      fontSize: 10,
      align: "center",
      color: s.paper,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 70,
      w: 70,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 28,
      align: "center",
      color: s.paper,
      uppercase: true,
      letterSpacing: 1.5,
      x: 8,
      y: 74,
      w: 84,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 12,
      align: "center",
      color: s.paper,
      x: 20,
      y: 82,
      w: 60,
      h: 0,
    }),
    serviceDetails(s, 86, s.paper),
  ],

  /** Colour ground throughout, portrait held in a thin light rule, script name. */
  "solid-frame": (s) => [
    border({ variant: "single", color: s.paper, x: 8, y: 6, w: 84, h: 88 }),
    photo({ x: 16, y: 12, w: 68, h: 47 }),
    text({
      text: "In loving memory of",
      fontFamily: s.body,
      fontSize: 10,
      align: "center",
      color: s.paper,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 62,
      w: 70,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.script,
      fontSize: 40,
      align: "center",
      color: s.paper,
      x: 8,
      y: 64,
      w: 84,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 12,
      align: "center",
      color: s.paper,
      x: 20,
      y: 76,
      w: 60,
      h: 0,
    }),
    serviceDetails(s, 81, s.paper),
  ],
};

export type SolidArchetypeId = keyof typeof SOLID_COVERS;

export const SOLID_ARCHETYPE_IDS = Object.keys(SOLID_COVERS) as SolidArchetypeId[];

export function isSolidArchetype(id: string): id is SolidArchetypeId {
  return id in SOLID_COVERS;
}

/**
 * Photo-led compositions built around a cutout spray.
 *
 * This is how funeral stationery actually works: the photograph of the person
 * is the subject and the florals frame it — a corner spray, a bottom spray, a
 * diagonal pair. Artwork that fills the page and pushes the photo out reads as
 * a botanical print, not a memorial. Everything sits on plain paper; there is
 * no background image in these.
 */
const SPRAY_COVERS: Record<string, (style: TemplateStyle, spray: string) => CanvasElement[]> = {
  /** Large portrait photo, formal type block, one spray along the bottom edge. */
  keepsake: (s, src) => [
    text({
      text: "In loving memory of",
      fontFamily: s.body,
      fontSize: 11,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 7,
      w: 70,
      h: 0,
    }),
    photo({ x: 14, y: 10, w: 72, h: 50 }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 29,
      align: "center",
      color: s.ink,
      x: 8,
      y: 62,
      w: 84,
      h: 0,
    }),
    rule({ color: s.accent, strokeWidth: 1, x: 37, y: 70, w: 26, h: 0.4 }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      x: 20,
      y: 73,
      w: 60,
      h: 0,
    }),
    // Narrowed so it clears the corner spray's column entirely.
    { ...serviceDetails(s, 77), x: 32, w: 36 } as CanvasElement,
    // Anchored into the corner and given real size — a small spray floating
    // centrally under the type reads as an afterthought — but strictly below
    // the type block, never across it.
    sprayElement(src, { x: 0, y: 79, w: 30, h: 21 }),
  ],

  /** Oval portrait held between a diagonal pair of sprays. */
  "portrait-corners": (s, src) => [
    // The second copy is turned 180 degrees rather than mirrored — an image
    // element can rotate but not flip, and a rotated spray reads as a
    // deliberate pair rather than a repeat.
    sprayElement(src, { x: -7, y: -4, w: 38, h: 23 }),
    sprayElement(src, { x: 69, y: 81, w: 38, h: 23 }, 180),
    text({
      text: "In loving memory of",
      fontFamily: s.body,
      fontSize: 11,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 19,
      w: 70,
      h: 0,
    }),
    photo({ shape: "oval", x: 24, y: 23, w: 52, h: squareH(52) }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 28,
      align: "center",
      color: s.ink,
      x: 8,
      y: 61,
      w: 84,
      h: 0,
    }),
    rule({ color: s.accent, strokeWidth: 1, x: 39, y: 69.5, w: 22, h: 0.4 }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      x: 20,
      y: 72.5,
      w: 60,
      h: 0,
    }),
    serviceDetails(s, 76.5),
  ],

  /**
   * Spray running the full height of one edge, everything else in the column
   * beside it. The best fit for these plates: they are tall single specimens,
   * so a tall box shows them at full size where a wide "bottom band" box
   * would letterbox them down to nothing.
   */
  "side-stem": (s, src) => [
    sprayElement(src, { x: 58, y: 3, w: 42, h: 94 }),
    photo({ shape: "oval", x: 3, y: 8, w: 50, h: squareH(50) }),
    text({
      text: "In loving memory of",
      fontFamily: s.body,
      fontSize: 10,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 3,
      x: 4,
      y: 44,
      w: 48,
      h: 0,
    }),
    text({
      // Sized to sit on one line inside a half-width column — a script face
      // set as large as a full-width heading wraps and lands on the dates.
      text: PLACEHOLDER_NAME,
      fontFamily: s.script,
      fontSize: 24,
      align: "center",
      color: s.accent,
      x: 2,
      y: 47,
      w: 52,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 11,
      align: "center",
      color: s.muted,
      x: 4,
      y: 56,
      w: 48,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_SERVICE,
      fontFamily: s.body,
      fontSize: 10,
      align: "center",
      color: s.muted,
      x: 4,
      y: 61,
      w: 48,
      h: 0,
    }),
  ],

  /** Arch photo window with the spray tucked into the bottom-left corner. */
  "arch-spray": (s, src) => [
    border({ variant: "single", color: s.accent, x: 5, y: 4, w: 90, h: 92 }),
    photo({ shape: "arch", x: 22, y: 9, w: 56, h: 47 }),
    text({
      text: PLACEHOLDER_NAME,
      fontFamily: s.heading,
      fontSize: 29,
      align: "center",
      color: s.ink,
      uppercase: true,
      letterSpacing: 1.5,
      x: 8,
      y: 59,
      w: 84,
      h: 0,
    }),
    rule({ color: s.accent, strokeWidth: 1, x: 38, y: 67.5, w: 24, h: 0.4 }),
    text({
      text: PLACEHOLDER_DATES,
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      x: 20,
      y: 70.5,
      w: 60,
      h: 0,
    }),
    serviceDetails(s, 74),
    // Inside the frame on every side — a spray crossing the border line reads
    // as a mistake rather than an overlap.
    sprayElement(src, { x: 8, y: 79, w: 30, h: 16 }),
  ],
};

export type SprayArchetypeId = keyof typeof SPRAY_COVERS;

export const SPRAY_ARCHETYPE_IDS = Object.keys(SPRAY_COVERS) as SprayArchetypeId[];

export function isSprayArchetype(id: string): id is SprayArchetypeId {
  return id in SPRAY_COVERS;
}

/** The back page of a spray template: a small spray over the farewell. */
function sprayBackPage(style: TemplateStyle, src: string): CanvasElement[] {
  return [
    sprayElement(src, { x: 33, y: 14, w: 34, h: 17 }),
    text({
      text: FAREWELL,
      fontFamily: style.script,
      fontSize: 28,
      align: "center",
      color: style.ink,
      x: 10,
      y: 36,
      w: 80,
      h: 0,
    }),
    text({
      text: THANKS,
      fontFamily: style.body,
      fontSize: 12,
      align: "center",
      color: style.muted,
      x: 15,
      y: 49,
      w: 70,
      h: 0,
    }),
  ];
}

/**
 * Compositions for the few plates that can't be cut out (see the Madonna
 * lily's spec), where the artwork stays a full-bleed wash instead.
 *
 * Still photo-led: the portrait sits over the wash and the name and dates go
 * in whichever zone the background leaves clear (BackgroundSpec.textZone).
 * The wash is knocked well back so it reads as tone behind the person, not as
 * a botanical print with type on it.
 */
const ARTWORK_COVERS: Record<string, (style: TemplateStyle, zone: TextZone) => CanvasElement[]> = {
  /** Oval portrait over the wash, name and dates in the artwork's clear zone. */
  "wash-portrait": (s, zone) => {
    const top = zone === "bottom" ? 10 : 34;
    const textTop = zone === "bottom" ? 58 : 8;
    return [
      photo({ shape: "oval", x: 24, y: top, w: 52, h: squareH(52) }),
      text({
        text: "In loving memory of",
        fontFamily: s.body,
        fontSize: 11,
        align: "center",
        color: s.muted,
        uppercase: true,
        letterSpacing: 4,
        x: 15,
        y: textTop,
        w: 70,
        h: 0,
      }),
      text({
        text: PLACEHOLDER_NAME,
        fontFamily: s.heading,
        fontSize: 30,
        align: "center",
        color: s.ink,
        x: 8,
        y: textTop + 4,
        w: 84,
        h: 0,
      }),
      rule({ color: s.accent, strokeWidth: 1, x: 38, y: textTop + 13, w: 24, h: 0.4 }),
      text({
        text: PLACEHOLDER_DATES,
        fontFamily: s.body,
        fontSize: 14,
        align: "center",
        color: s.muted,
        x: 20,
        y: textTop + 16,
        w: 60,
        h: 0,
      }),
      serviceDetails(s, textTop + 21),
    ];
  },

  /** Arch portrait over the wash, with the farewell closing the page. */
  "wash-arch": (s, zone) => {
    const top = zone === "bottom" ? 9 : 36;
    const textTop = zone === "bottom" ? 56 : 8;
    return [
      photo({ shape: "arch", x: 23, y: top, w: 54, h: 45 }),
      text({
        text: PLACEHOLDER_NAME,
        fontFamily: s.heading,
        fontSize: 29,
        align: "center",
        color: s.ink,
        uppercase: true,
        letterSpacing: 1.5,
        x: 8,
        y: textTop,
        w: 84,
        h: 0,
      }),
      rule({ color: s.accent, strokeWidth: 1, x: 38, y: textTop + 8.5, w: 24, h: 0.4 }),
      text({
        text: PLACEHOLDER_DATES,
        fontFamily: s.body,
        fontSize: 13,
        align: "center",
        color: s.muted,
        x: 20,
        y: textTop + 11.5,
        w: 60,
        h: 0,
      }),
      serviceDetails(s, textTop + 16),
    ];
  },
};

export type ArtworkArchetypeId = keyof typeof ARTWORK_COVERS;

export const ARTWORK_ARCHETYPE_IDS = Object.keys(ARTWORK_COVERS) as ArtworkArchetypeId[];

export function isArtworkArchetype(id: string): id is ArtworkArchetypeId {
  return id in ARTWORK_COVERS;
}

/** Archetypes whose interior pages carry a matching border. */
const BORDERED_INTERIORS: ReadonlySet<ArchetypeId> = new Set<ArchetypeId>(["framed", "arch"]);

/**
 * The page that repeats to fill everything between cover and back — see
 * withPageCount. It carries the running order, so it has to read well both as
 * a single spread and repeated a dozen times.
 */
function middlePage(style: TemplateStyle, archetype: ArchetypeId): CanvasElement[] {
  return [
    ...(BORDERED_INTERIORS.has(archetype)
      ? [border({ variant: "single", color: style.accent, x: 6, y: 5, w: 88, h: 90 })]
      : []),
    text({
      text: "Order of Service",
      fontFamily: style.heading,
      fontSize: 24,
      align: "center",
      color: style.ink,
      x: 10,
      y: 11,
      w: 80,
      h: 0,
    }),
    rule({ color: style.accent, strokeWidth: 1, x: 35, y: 17.5, w: 30, h: 0.3 }),
    text({
      text: RUNNING_ORDER,
      fontFamily: style.body,
      fontSize: 13,
      align: "center",
      color: style.muted,
      x: 12,
      y: 23,
      w: 76,
      h: 0,
    }),
  ];
}

function backPage(style: TemplateStyle): CanvasElement[] {
  return [
    motif({ icon: style.icon, color: style.accent, x: 44, y: 24, w: 12, h: squareH(12) }),
    text({
      text: FAREWELL,
      fontFamily: style.script,
      fontSize: 28,
      align: "center",
      color: style.ink,
      x: 10,
      y: 37,
      w: 80,
      h: 0,
    }),
    text({
      text: THANKS,
      fontFamily: style.body,
      fontSize: 12,
      align: "center",
      color: style.muted,
      x: 15,
      y: 50,
      w: 70,
      h: 0,
    }),
  ];
}

/** The back page of an artwork template wraps the same picture, farewell in the clear zone. */
function artworkBackPage(style: TemplateStyle, zone: TextZone): CanvasElement[] {
  const top = zone === "bottom" ? 68 : 10;
  return [
    text({
      text: FAREWELL,
      fontFamily: style.script,
      fontSize: 28,
      align: "center",
      color: style.ink,
      x: 10,
      y: top,
      w: 80,
      h: 0,
    }),
    text({
      text: THANKS,
      fontFamily: style.body,
      fontSize: 12,
      align: "center",
      color: style.muted,
      x: 15,
      y: top + 12,
      w: 70,
      h: 0,
    }),
  ];
}

/** One generated template: what to build, and the catalogue metadata for it. */
export interface TemplateSpec {
  slug: string;
  name: string;
  /**
   * A paper composition, a full-bleed artwork one (requires a `background`
   * asset), or a photo-led spray one (requires that background's cutout).
   */
  archetype: ArchetypeId | ArtworkArchetypeId | SprayArchetypeId | SolidArchetypeId;
  palette: PaletteId;
  typeSet: TypeSetId;
  /** Clipart id — see CLIPARTS in DesignEditor. */
  icon: string;
  categories: string[];
  /**
   * BackgroundSpec id (src/lib/backgroundArtwork.ts). The rendered asset for
   * this spec's palette sits behind the cover and back page as a locked,
   * full-bleed image; `palette` must be one the background was rendered for.
   */
  background?: string;
}

export interface BuildLayoutOptions {
  /** URL of the rendered background for `spec.background` + `spec.palette`. */
  backgroundUrl?: string;
  /** URL of the rendered cutout spray for `spec.background`. */
  sprayUrl?: string;
}

export function styleFor(spec: TemplateSpec): TemplateStyle {
  return {
    ...TEMPLATE_PALETTES[spec.palette],
    ...TEMPLATE_TYPE_SETS[spec.typeSet],
    icon: spec.icon,
  };
}

/**
 * Build the cover/middle/back triple for a spec. Always exactly
 * TEMPLATE_PAGE_COUNT pages, so the result satisfies parseLayoutPages and can
 * be written straight to templates.layout.
 */
export function buildTemplateLayout(
  spec: TemplateSpec,
  options: BuildLayoutOptions = {},
): DesignPage[] {
  const style = styleFor(spec);
  const pages: DesignPage[] = isSolidArchetype(spec.archetype)
    ? solidPages(spec.archetype, style)
    : isSprayArchetype(spec.archetype)
    ? sprayPages(spec, spec.archetype, style, options)
    : isArtworkArchetype(spec.archetype)
    ? artworkPages(spec, spec.archetype, style, options)
    : [
        { id: uid("page"), background: style.paper, elements: COVERS[spec.archetype](style) },
        { id: uid("page"), background: style.paper, elements: middlePage(style, spec.archetype) },
        { id: uid("page"), background: style.paper, elements: backPage(style) },
      ];
  if (pages.length !== TEMPLATE_PAGE_COUNT) {
    throw new Error(`Expected ${TEMPLATE_PAGE_COUNT} pages, built ${pages.length}`);
  }
  return pages;
}

/**
 * Cover and back page on a deep field of the palette accent, with a plain
 * paper middle page — the running order has to stay readable, and light type
 * on a colour field repeated a dozen times does not.
 */
function solidPages(archetype: SolidArchetypeId, style: TemplateStyle): DesignPage[] {
  return [
    { id: uid("page"), background: style.accent, elements: SOLID_COVERS[archetype](style) },
    { id: uid("page"), background: style.paper, elements: middlePage(style, "minimal") },
    {
      id: uid("page"),
      background: style.accent,
      elements: [
        text({
          text: FAREWELL,
          fontFamily: style.script,
          fontSize: 30,
          align: "center",
          color: style.paper,
          x: 10,
          y: 34,
          w: 80,
          h: 0,
        }),
        text({
          text: THANKS,
          fontFamily: style.body,
          fontSize: 12,
          align: "center",
          color: style.paper,
          x: 15,
          y: 48,
          w: 70,
          h: 0,
        }),
      ],
    },
  ];
}

/**
 * Photo-led pages on plain paper, with the cutout spray as an accent. Refuses
 * to build without the cutout, or for a background that has no spray at all.
 */
function sprayPages(
  spec: TemplateSpec,
  archetype: SprayArchetypeId,
  style: TemplateStyle,
  options: BuildLayoutOptions,
): DesignPage[] {
  if (!spec.background) {
    throw new Error(`Spec "${spec.slug}" uses spray archetype "${archetype}" but has no background`);
  }
  const background = getBackgroundSpec(spec.background);
  if (!background) throw new Error(`Spec "${spec.slug}": unknown background "${spec.background}"`);
  if (!background.spray) {
    throw new Error(`Spec "${spec.slug}": background "${spec.background}" has no spray cutout`);
  }
  if (!options.sprayUrl) {
    throw new Error(`Spec "${spec.slug}" needs sprayUrl — run npm run backgrounds:fetch first`);
  }
  return [
    {
      id: uid("page"),
      background: style.paper,
      elements: SPRAY_COVERS[archetype](style, options.sprayUrl),
    },
    { id: uid("page"), background: style.paper, elements: middlePage(style, "minimal") },
    {
      id: uid("page"),
      background: style.paper,
      elements: sprayBackPage(style, options.sprayUrl),
    },
  ];
}

/**
 * Cover and back page over the artwork, a plain paper middle page. The
 * background image is always element 0 so everything else draws above it.
 * Refuses to build without the asset URL rather than quietly producing a
 * paper template with an artwork composition on it.
 */
function artworkPages(
  spec: TemplateSpec,
  archetype: ArtworkArchetypeId,
  style: TemplateStyle,
  options: BuildLayoutOptions,
): DesignPage[] {
  if (!spec.background) {
    throw new Error(`Spec "${spec.slug}" uses artwork archetype "${archetype}" but has no background`);
  }
  const background = getBackgroundSpec(spec.background);
  if (!background) throw new Error(`Spec "${spec.slug}": unknown background "${spec.background}"`);
  if (!background.palettes.includes(spec.palette)) {
    throw new Error(
      `Spec "${spec.slug}": background "${spec.background}" is not rendered for palette "${spec.palette}"`,
    );
  }
  if (!options.backgroundUrl) {
    throw new Error(`Spec "${spec.slug}" needs backgroundUrl — run npm run backgrounds:fetch first`);
  }
  const zone = background.textZone;
  return [
    {
      id: uid("page"),
      background: style.paper,
      elements: [
        backgroundElement(options.backgroundUrl),
        ...ARTWORK_COVERS[archetype](style, zone),
      ],
    },
    { id: uid("page"), background: style.paper, elements: middlePage(style, "minimal") },
    {
      id: uid("page"),
      background: style.paper,
      elements: [backgroundElement(options.backgroundUrl), ...artworkBackPage(style, zone)],
    },
  ];
}

/** Kebab-cased slug for a display name. Slugs are immutable once created. */
export function slugForName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The curated catalogue. Combinations are hand-picked rather than generated
 * as a full cartesian product — 5 archetypes x 6 palettes x 6 type sets x 12
 * motifs is over 2000 permutations, and shipping all of them would read as
 * machine-stamped. Names are chosen to be distinct from the seeded templates
 * in seedCatalogue.ts, since slugs are unique and immutable.
 */
const CURATED: Array<
  [name: string, archetype: ArchetypeId, palette: PaletteId, typeSet: TypeSetId, icon: string, categories: string[]]
> = [
  ["Whispering Petals", "framed", "plum", "classic", "flower", ["floral", "classic"]],
  ["Lilac Remembrance", "arch", "plum", "cormorant", "flower", ["floral", "classic"]],
  ["Garden Light", "portrait", "plum", "playfair", "flower", ["floral", "colourful"]],
  ["Fern Hollow", "framed", "forest", "garamond", "leaf", ["nature", "calm"]],
  ["Woodland Rest", "arch", "forest", "classic", "tree", ["nature", "calm"]],
  ["Open Meadow", "portrait", "forest", "baskerville", "leaf", ["nature", "simple"]],
  ["Harbour Calm", "portrait", "slate", "playfair", "bird", ["birds", "calm"]],
  ["Northern Sky", "minimal", "slate", "prata", "bird", ["birds", "modern"]],
  ["Tide and Time", "framed", "slate", "baskerville", "feather", ["calm", "classic"]],
  ["Amber Evening", "arch", "bronze", "garamond", "candle", ["religious", "classic"]],
  ["Chapel Bell", "framed", "bronze", "classic", "cross", ["religious", "classic"]],
  ["Quiet Psalm", "minimal", "bronze", "cormorant", "cross", ["religious", "simple"]],
  ["Pure Simplicity", "minimal", "ink", "prata", "sparkles", ["minimalistic", "simple"]],
  ["Clean Slate", "minimal", "ink", "playfair", "star", ["minimalistic", "modern"]],
  ["Monochrome Grace", "portrait", "ink", "baskerville", "heart", ["modern", "classic"]],
  ["Soft Ashes", "framed", "stone", "cormorant", "feather", ["minimalistic", "calm"]],
  ["Morning Hush", "minimal", "stone", "garamond", "sun", ["calm", "simple"]],
  ["Gentle Chorus", "corners", "stone", "classic", "music", ["colourful", "classic"]],
  ["Songbird Meadow", "corners", "forest", "playfair", "bird", ["birds", "nature"]],
  ["Heartfelt Tribute", "corners", "plum", "baskerville", "heart", ["floral", "colourful"]],
];

/**
 * Templates built over background artwork (see BACKGROUND_SPECS). Each
 * background appears twice — once typographic, once with a portrait — in a
 * palette it was rendered for. The artwork is what makes these distinct, so
 * two templates on one picture in one palette would be a duplicate.
 */
const CURATED_ARTWORK: Array<
  [
    name: string,
    archetype: ArtworkArchetypeId | SprayArchetypeId,
    background: string,
    palette: PaletteId,
    typeSet: TypeSetId,
    icon: string,
    categories: string[],
  ]
> = [
  // Photo-led, spray-framed — the main register. The photograph is the
  // subject; the cutout frames it.
  ["Rose of Josephine", "keepsake", "redoute-frankfort-rose", "plum", "cormorant", "flower", ["floral", "classic"]],
  ["Empress Rose", "portrait-corners", "redoute-frankfort-rose", "bronze", "garamond", "flower", ["floral", "classic"]],
  ["Crown Imperial", "arch-spray", "redoute-crown-imperial", "forest", "playfair", "leaf", ["floral", "nature"]],
  ["Golden Crown", "keepsake", "redoute-crown-imperial", "bronze", "classic", "flower", ["floral", "religious"]],
  ["Climbing Lily", "portrait-corners", "redoute-climbing-lily", "plum", "prata", "flower", ["floral", "colourful"]],
  ["Flame Lily", "keepsake", "redoute-climbing-lily", "forest", "baskerville", "leaf", ["floral", "nature"]],
  ["Heather Moor", "arch-spray", "redoute-erica", "stone", "garamond", "leaf", ["nature", "calm"]],
  ["Heath Light", "side-stem", "redoute-erica", "plum", "cormorant", "flower", ["floral", "calm"]],
  ["Burgundy Rose", "keepsake", "redoute-burgundy-rose", "plum", "playfair", "flower", ["floral", "classic"]],
  ["Velvet Rose", "portrait-corners", "redoute-burgundy-rose", "stone", "prata", "heart", ["floral", "modern"]],
  ["Cabbage Rose", "arch-spray", "redoute-cabbage-rose", "bronze", "baskerville", "flower", ["floral", "classic"]],
  ["Old Rose", "side-stem", "redoute-cabbage-rose", "plum", "classic", "flower", ["floral", "classic"]],
  ["Martagon Lily", "portrait-corners", "redoute-martagon-lily", "plum", "cormorant", "flower", ["floral", "colourful"]],
  ["Turban Lily", "keepsake", "redoute-martagon-lily", "slate", "garamond", "flower", ["floral", "modern"]],
  // Full-bleed wash — only for the Madonna lily, whose white-on-cream plate
  // can't be cut out (see its spec).
  ["Madonna Lily", "wash-portrait", "redoute-madonna-lily", "stone", "cormorant", "flower", ["floral", "religious"]],
  ["White Lily", "wash-arch", "redoute-madonna-lily", "bronze", "playfair", "flower", ["floral", "classic"]],
];

/**
 * Solid-ground templates. These reference no background at all, so they never
 * wait on artwork being sourced or cut. Only palettes with a genuinely deep
 * accent are used — light type has to hold against the ground.
 */
const CURATED_SOLID: Array<
  [
    name: string,
    archetype: SolidArchetypeId,
    palette: PaletteId,
    typeSet: TypeSetId,
    icon: string,
    categories: string[],
  ]
> = [
  ["Midnight Portrait", "solid-block", "slate", "playfair", "star", ["modern", "simple"]],
  ["Deep Green", "solid-frame", "forest", "cormorant", "leaf", ["nature", "classic"]],
  ["Charcoal Tribute", "solid-block", "ink", "prata", "sparkles", ["minimalistic", "modern"]],
  ["Bronze Keepsake", "solid-frame", "bronze", "garamond", "candle", ["classic", "religious"]],
  ["Amethyst Memory", "solid-frame", "plum", "baskerville", "heart", ["colourful", "classic"]],
  ["Harbour Blue", "solid-block", "slate", "classic", "bird", ["calm", "modern"]],
];

export const TEMPLATE_SPECS: TemplateSpec[] = [
  ...CURATED.map(
    ([name, archetype, palette, typeSet, icon, categories]): TemplateSpec => ({
      slug: slugForName(name),
      name,
      archetype,
      palette,
      typeSet,
      icon,
      categories,
    }),
  ),
  ...CURATED_ARTWORK.map(
    ([name, archetype, background, palette, typeSet, icon, categories]): TemplateSpec => ({
      slug: slugForName(name),
      name,
      archetype,
      background,
      palette,
      typeSet,
      icon,
      categories,
    }),
  ),
  ...CURATED_SOLID.map(
    ([name, archetype, palette, typeSet, icon, categories]): TemplateSpec => ({
      slug: slugForName(name),
      name,
      archetype,
      palette,
      typeSet,
      icon,
      categories,
    }),
  ),
];
