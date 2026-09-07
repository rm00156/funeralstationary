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
import { backgroundElement, getBackgroundSpec, type TextZone } from "@/lib/backgroundArtwork";

/**
 * Element coordinates are percentages of a page that is taller than it is
 * wide, so a box is only square on the printed page when its height percentage
 * is scaled by the page's aspect ratio. Round photos need this or they print
 * as ovals.
 */
const squareH = (w: number) => (w * PAGE_W_MM) / PAGE_H_MM;

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
 * Compositions for templates with background artwork. The picture is the
 * artwork itself, so these put the name and dates in whichever zone the
 * background leaves clear (see BackgroundSpec.textZone) and otherwise stay
 * out of its way — no borders, no motifs competing with a Redouté rose.
 */
const ARTWORK_COVERS: Record<string, (style: TemplateStyle, zone: TextZone) => CanvasElement[]> = {
  /** Typographic: overline, name, rule and dates in the clear zone. No photo. */
  artwork: (s, zone) => {
    const top = zone === "bottom" ? 66 : 8;
    return [
      text({
        text: "in loving memory of",
        fontFamily: s.body,
        fontSize: 11,
        align: "center",
        color: s.muted,
        uppercase: true,
        letterSpacing: 4,
        x: 15,
        y: top,
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
        y: top + 4.5,
        w: 84,
        h: 0,
      }),
      rule({ color: s.accent, strokeWidth: 1, x: 36, y: top + 14.5, w: 28, h: 0.4 }),
      text({
        text: PLACEHOLDER_DATES,
        fontFamily: s.body,
        fontSize: 14,
        align: "center",
        color: s.muted,
        x: 20,
        y: top + 18,
        w: 60,
        h: 0,
      }),
      text({
        text: FAREWELL,
        fontFamily: s.script,
        fontSize: 26,
        align: "center",
        color: s.accent,
        x: 15,
        y: top + 23.5,
        w: 70,
        h: 0,
      }),
    ];
  },

  /** As above with a small oval portrait beside the artwork's clear zone. */
  "artwork-portrait": (s, zone) => {
    const top = zone === "bottom" ? 58 : 6;
    return [
      photo({ shape: "oval", x: 38, y: top, w: 24, h: squareH(24) }),
      text({
        text: PLACEHOLDER_NAME,
        fontFamily: s.heading,
        fontSize: 30,
        align: "center",
        color: s.ink,
        x: 8,
        y: top + 19,
        w: 84,
        h: 0,
      }),
      rule({ color: s.accent, strokeWidth: 1, x: 38, y: top + 27.5, w: 24, h: 0.4 }),
      text({
        text: PLACEHOLDER_DATES,
        fontFamily: s.body,
        fontSize: 14,
        align: "center",
        color: s.muted,
        x: 20,
        y: top + 30.5,
        w: 60,
        h: 0,
      }),
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
  /** A paper composition, or an artwork one — the latter requires `background`. */
  archetype: ArchetypeId | ArtworkArchetypeId;
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
  const pages: DesignPage[] = isArtworkArchetype(spec.archetype)
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
    archetype: ArtworkArchetypeId,
    background: string,
    palette: PaletteId,
    typeSet: TypeSetId,
    icon: string,
    categories: string[],
  ]
> = [
  ["Rose of Josephine", "artwork", "redoute-frankfort-rose", "plum", "cormorant", "flower", ["floral", "classic"]],
  ["Empress Rose", "artwork-portrait", "redoute-frankfort-rose", "bronze", "garamond", "flower", ["floral", "classic"]],
  ["Crown Imperial", "artwork", "redoute-crown-imperial", "forest", "playfair", "leaf", ["floral", "nature"]],
  ["Golden Crown", "artwork-portrait", "redoute-crown-imperial", "bronze", "classic", "flower", ["floral", "religious"]],
  ["Climbing Lily", "artwork", "redoute-climbing-lily", "plum", "prata", "flower", ["floral", "colourful"]],
  ["Flame Lily", "artwork-portrait", "redoute-climbing-lily", "forest", "baskerville", "leaf", ["floral", "nature"]],
  ["Heather Moor", "artwork", "redoute-erica", "stone", "garamond", "leaf", ["nature", "calm"]],
  ["Heath Light", "artwork-portrait", "redoute-erica", "plum", "cormorant", "flower", ["floral", "calm"]],
  ["Burgundy Rose", "artwork", "redoute-burgundy-rose", "plum", "playfair", "flower", ["floral", "classic"]],
  ["Velvet Rose", "artwork-portrait", "redoute-burgundy-rose", "stone", "prata", "heart", ["floral", "modern"]],
  ["Cabbage Rose", "artwork", "redoute-cabbage-rose", "bronze", "baskerville", "flower", ["floral", "classic"]],
  ["Old Rose", "artwork-portrait", "redoute-cabbage-rose", "plum", "classic", "flower", ["floral", "classic"]],
  ["Madonna Lily", "artwork", "redoute-madonna-lily", "stone", "cormorant", "flower", ["floral", "religious"]],
  ["White Lily", "artwork-portrait", "redoute-madonna-lily", "bronze", "playfair", "flower", ["floral", "classic"]],
  ["Martagon Lily", "artwork", "redoute-martagon-lily", "plum", "prata", "flower", ["floral", "colourful"]],
  ["Turban Lily", "artwork-portrait", "redoute-martagon-lily", "slate", "garamond", "flower", ["floral", "modern"]],
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
];
