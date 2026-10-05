/**
 * Generated templates for the flat products — memorial and thank-you cards,
 * bookmarks and the memory board — the counterpart of templateGenerator.ts's
 * booklet library, and pure and DB-free for the same reason.
 *
 * A6 and every A size share the A5 booklet's shape, and element positions are
 * percentages, so a booklet cover *is* a card front or a board: this builds
 * the booklet spec, keeps its cover (and back page, for a two-sided card) and
 * scales the type to the new trim. That keeps the cards and boards in the
 * same visual family as the booklets customers have already seen. Only what
 * a booklet has no equivalent for gets its own composition here: the
 * thank-you card's front, the bookmark (a quarter as wide as it is tall),
 * and the memory board's photo collage.
 *
 * Borrowed covers are paper, solid and spray archetypes only: the booklet's
 * full-bleed artwork ones place their background at A5's bleed, which falls
 * short of the bleed on any other trim. The memorial card and bookmark set
 * below draws its own photo-led compositions instead, and places its
 * background at the product's own bleed (a bookmark has its own render).
 */
import {
  A5_TRIM,
  uid,
  type CanvasElement,
  type DesignPage,
  type ImageElement,
  type PageTrim,
  type TextElement,
} from "@/lib/designEditor";
import {
  backgroundElement,
  getBackgroundSpec,
  sprayElement,
  type BackgroundFormat,
} from "@/lib/backgroundArtwork";
import {
  ARCHETYPE_IDS,
  FAREWELL,
  PLACEHOLDER_DATES,
  PLACEHOLDER_NAME,
  PLACEHOLDER_SERVICE,
  SPRAY_ARCHETYPE_IDS,
  TEMPLATE_PALETTES,
  TEMPLATE_TYPE_SETS,
  buildTemplateLayout,
  isSprayArchetype,
  slugForName,
  SOLID_ARCHETYPE_IDS,
  type ArchetypeId,
  type PaletteId,
  type SolidArchetypeId,
  type SprayArchetypeId,
  type TemplateStyle,
  type TypeSetId,
} from "@/lib/templateGenerator";

export const FLAT_PRODUCTS = ["memorial-cards", "thank-you-cards", "bookmarks", "memory-board"] as const;
export type FlatProductId = (typeof FLAT_PRODUCTS)[number];

/** How many template pages each flat product authors (its products.template_pages). */
export const FLAT_TEMPLATE_PAGES: Record<FlatProductId, 1 | 2> = {
  "memorial-cards": 2,
  "thank-you-cards": 2,
  bookmarks: 2,
  "memory-board": 1,
};

/** Compositions this module draws itself, by the product they're for. */
const OWN_ARCHETYPES = {
  "thanks-script": "thank-you-cards",
  "thanks-photo": "thank-you-cards",
  "thanks-spray": "thank-you-cards",
  "bookmark-photo": "bookmarks",
  "bookmark-solid": "bookmarks",
  "bookmark-spray": "bookmarks",
  "board-collage": "memory-board",
  "card-scene": "memorial-cards",
  "card-band": "memorial-cards",
  "card-stem": "memorial-cards",
  "card-corner": "memorial-cards",
  "card-flutter": "memorial-cards",
  "card-branch": "memorial-cards",
  "bookmark-scene": "bookmarks",
  "bookmark-band": "bookmarks",
  "bookmark-bloom": "bookmarks",
  "bookmark-flutter": "bookmarks",
} as const satisfies Record<string, FlatProductId>;
type OwnArchetypeId = keyof typeof OWN_ARCHETYPES;

export interface FlatTemplateSpec {
  slug: string;
  name: string;
  product: FlatProductId;
  /**
   * A booklet cover (paper, solid or spray archetype, for the A-series
   * products) or one of this module's own compositions.
   */
  archetype: ArchetypeId | SprayArchetypeId | SolidArchetypeId | OwnArchetypeId;
  palette: PaletteId;
  typeSet: TypeSetId;
  icon: string;
  categories: string[];
  /** BackgroundSpec id of the cutout spray, for a spray archetype. */
  spray?: string;
  /**
   * BackgroundSpec id of the photograph behind a scene or band archetype,
   * rendered for `palette` in this product's format (flatBackgroundFormat).
   */
  background?: string;
}

export interface BuildFlatOptions {
  /** URL of the rendered cutout for `spec.spray`. */
  sprayUrl?: string;
  /** URL of `spec.background` rendered for `spec.palette` in flatBackgroundFormat(spec). */
  backgroundUrl?: string;
}

const styleOf = (spec: FlatTemplateSpec): TemplateStyle => ({
  ...TEMPLATE_PALETTES[spec.palette],
  ...TEMPLATE_TYPE_SETS[spec.typeSet],
  icon: spec.icon,
});

const isAsize = (trim: PageTrim) =>
  Math.abs(trim.widthMm / trim.heightMm - A5_TRIM.widthMm / A5_TRIM.heightMm) < 0.02;

/* ------------------------------------------------------------------ */
/* Element helpers                                                     */
/* ------------------------------------------------------------------ */

const text = (
  props: Omit<TextElement, "id" | "type"> & { placeholder?: boolean },
): CanvasElement => ({ id: uid("text"), type: "text", ...props });

const photo = (props: Omit<ImageElement, "id" | "type" | "src">): CanvasElement => ({
  id: uid("image"),
  type: "image",
  src: null,
  ...props,
});

const rule = (color: string, x: number, y: number, w: number, h: number): CanvasElement => ({
  id: uid("shape"),
  type: "shape",
  shape: "line",
  color,
  strokeWidth: 1,
  x,
  y,
  w,
  h,
});

const motif = (icon: string, color: string, x: number, y: number, w: number, h: number) =>
  ({ id: uid("clipart"), type: "clipart", icon, color, x, y, w, h }) as CanvasElement;

const frame = (
  variant: "single" | "double" | "triple",
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => ({ id: uid("frame"), type: "frame", variant, color, x, y, w, h }) as CanvasElement;

const page = (background: string, elements: CanvasElement[]): DesignPage => ({
  id: uid("page"),
  background,
  elements,
});

/** A square box on an A-series page is shorter in percent than it is wide. */
const squareH = (w: number) => (w * A5_TRIM.widthMm) / A5_TRIM.heightMm;

const VERSE =
  "Those we love don't go away,\nthey walk beside us every day.\nUnseen, unheard, but always near,\nstill loved, still missed\nand very dear.";

/** Wording with the name in it is the customer's to change, so it warns if left. */
const THANK_YOU_MESSAGE = `The family of ${PLACEHOLDER_NAME} would like to thank you for your kind messages of sympathy, the beautiful flowers, and for being there for us.`;

/* ------------------------------------------------------------------ */
/* Thank-you cards — A-series, drawn in A5 units                       */
/* ------------------------------------------------------------------ */

function thankYouBack(s: TemplateStyle): CanvasElement[] {
  return [
    motif(s.icon, s.accent, 45, 22, 10, squareH(10)),
    text({
      text: THANK_YOU_MESSAGE,
      placeholder: true,
      fontFamily: s.body,
      fontSize: 15,
      align: "center",
      color: s.muted,
      x: 14,
      y: 34,
      w: 72,
      h: 0,
    }),
    text({
      text: "With love and thanks",
      fontFamily: s.script,
      fontSize: 32,
      align: "center",
      color: s.ink,
      x: 10,
      y: 64,
      w: 80,
      h: 0,
    }),
  ];
}

const thankYouHeading = (s: TemplateStyle, y: number, fontSize = 64): CanvasElement =>
  text({
    text: "Thank you",
    fontFamily: s.script,
    fontSize,
    align: "center",
    color: s.accent,
    x: 6,
    y,
    w: 88,
    h: 0,
  });

const THANK_YOU_FRONTS: Record<
  "thanks-script" | "thanks-photo" | "thanks-spray",
  (s: TemplateStyle, spray?: string) => CanvasElement[]
> = {
  /** Typographic: a big script line in a double border. */
  "thanks-script": (s) => [
    frame("double", s.accent, 5, 4, 90, 92),
    motif(s.icon, s.accent, 44, 24, 12, squareH(12)),
    thankYouHeading(s, 37),
    rule(s.accent, 38, 55, 24, 0.4),
    text({
      text: "for your kindness",
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 58,
      w: 70,
      h: 0,
    }),
  ],
  /** A round portrait over the heading and the family's name. */
  "thanks-photo": (s) => [
    photo({ shape: "oval", x: 28, y: 12, w: 44, h: squareH(44), border: "single", borderColor: s.accent }),
    thankYouHeading(s, 50, 58),
    text({
      text: `from the family of ${PLACEHOLDER_NAME}`,
      placeholder: true,
      fontFamily: s.body,
      fontSize: 14,
      align: "center",
      color: s.muted,
      x: 12,
      y: 67,
      w: 76,
      h: 0,
    }),
  ],
  /** The heading over a spray standing in the lower half. */
  "thanks-spray": (s, src) => [
    thankYouHeading(s, 18),
    text({
      text: "from all the family",
      fontFamily: s.body,
      fontSize: 13,
      align: "center",
      color: s.muted,
      uppercase: true,
      letterSpacing: 4,
      x: 15,
      y: 36,
      w: 70,
      h: 0,
    }),
    sprayElement(requireSpray(src), { x: 18, y: 46, w: 64, h: 48 }),
  ],
};

/* ------------------------------------------------------------------ */
/* Bookmarks — 50 × 200 mm, drawn in their own units                   */
/* ------------------------------------------------------------------ */

/** A square on a bookmark is a quarter as tall, in percent, as it is wide. */
const bookmarkSquareH = (w: number, trim: PageTrim) => (w * trim.widthMm) / trim.heightMm;

function bookmarkBack(s: TemplateStyle, light: boolean, spraySrc?: string): CanvasElement[] {
  const ink = light ? "#ffffff" : s.ink;
  const muted = light ? "#ffffff" : s.muted;
  return [
    ...(spraySrc
      ? [sprayElement(spraySrc, { x: 10, y: 4, w: 80, h: 14 })]
      : [motif(s.icon, light ? "#ffffff" : s.accent, 38, 7, 24, 6)]),
    text({
      text: FAREWELL,
      fontFamily: s.script,
      fontSize: 17,
      align: "center",
      color: ink,
      x: 6,
      y: 21,
      w: 88,
      h: 0,
    }),
    text({
      // Wide enough that the verse's longest line holds at this size.
      text: VERSE,
      fontFamily: s.body,
      fontSize: 9,
      italic: true,
      align: "center",
      color: muted,
      x: 4,
      y: 32,
      w: 92,
      h: 0,
    }),
    rule(light ? "#ffffff" : s.accent, 35, 62, 30, 0.15),
    text({
      text: PLACEHOLDER_NAME,
      placeholder: true,
      fontFamily: s.heading,
      fontSize: 12,
      align: "center",
      color: ink,
      x: 6,
      y: 65,
      w: 88,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_DATES,
      placeholder: true,
      fontFamily: s.body,
      fontSize: 9,
      align: "center",
      color: muted,
      x: 10,
      y: 70,
      w: 80,
      h: 0,
    }),
  ];
}

/** Name, dates and a short line, from `top` down — shared by the bookmark fronts. */
function bookmarkNameBlock(s: TemplateStyle, top: number, light = false): CanvasElement[] {
  const ink = light ? "#ffffff" : s.ink;
  const muted = light ? "#ffffff" : s.muted;
  return [
    text({
      text: PLACEHOLDER_NAME,
      placeholder: true,
      fontFamily: s.heading,
      fontSize: 16,
      align: "center",
      color: ink,
      x: 6,
      y: top,
      w: 88,
      h: 0,
    }),
    rule(light ? "#ffffff" : s.accent, 35, top + 9, 30, 0.15),
    text({
      text: PLACEHOLDER_DATES,
      placeholder: true,
      fontFamily: s.body,
      fontSize: 9.5,
      align: "center",
      color: muted,
      x: 10,
      y: top + 11,
      w: 80,
      h: 0,
    }),
  ];
}

function bookmarkPages(
  archetype: "bookmark-photo" | "bookmark-solid" | "bookmark-spray",
  s: TemplateStyle,
  trim: PageTrim,
  spray?: string,
): DesignPage[] {
  if (archetype === "bookmark-solid") {
    // Light type on a field of the accent; the portrait carries a white ring.
    const w = 70;
    return [
      page(s.accent, [
        text({
          text: "In loving memory",
          fontFamily: s.script,
          fontSize: 18,
          align: "center",
          color: "#ffffff",
          x: 6,
          y: 6,
          w: 88,
          h: 0,
        }),
        photo({
          shape: "oval",
          x: (100 - w) / 2,
          y: 13,
          w,
          h: bookmarkSquareH(w, trim),
          border: "single",
          borderColor: "#ffffff",
        }),
        ...bookmarkNameBlock(s, 36, true),
        motif(s.icon, "#ffffff", 40, 86, 20, 5),
      ]),
      page(s.accent, bookmarkBack(s, true)),
    ];
  }
  if (archetype === "bookmark-spray") {
    const src = requireSpray(spray);
    return [
      page(s.paper, [
        sprayElement(src, { x: 4, y: 1, w: 92, h: 16 }),
        photo({ x: 12, y: 19, w: 76, h: 26, border: "single", borderColor: s.accent }),
        ...bookmarkNameBlock(s, 48),
        text({
          text: "In loving memory",
          fontFamily: s.script,
          fontSize: 15,
          align: "center",
          color: s.accent,
          x: 6,
          y: 66,
          w: 88,
          h: 0,
        }),
      ]),
      page(s.paper, bookmarkBack(s, false, src)),
    ];
  }
  const w = 70;
  return [
    page(s.paper, [
      frame("single", s.accent, 6, 2, 88, 96),
      text({
        text: "In loving memory",
        fontFamily: s.script,
        fontSize: 17,
        align: "center",
        color: s.ink,
        x: 8,
        y: 5,
        w: 84,
        h: 0,
      }),
      photo({ shape: "oval", x: (100 - w) / 2, y: 12, w, h: bookmarkSquareH(w, trim) }),
      ...bookmarkNameBlock(s, 34),
      motif(s.icon, s.accent, 40, 84, 20, 5),
    ]),
    page(s.paper, bookmarkBack(s, false)),
  ];
}

/* ------------------------------------------------------------------ */
/* Memory board collage — A-series, drawn in A5 units                  */
/* ------------------------------------------------------------------ */

function boardCollage(s: TemplateStyle): CanvasElement[] {
  const window = (x: number, y: number, w: number, h: number) =>
    photo({ x, y, w, h, border: "single", borderColor: s.accent });
  return [
    text({
      text: "In loving memory of",
      fontFamily: s.script,
      fontSize: 34,
      align: "center",
      color: s.ink,
      x: 10,
      y: 3.5,
      w: 80,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_NAME,
      placeholder: true,
      fontFamily: s.heading,
      fontSize: 30,
      align: "center",
      color: s.ink,
      uppercase: true,
      letterSpacing: 1.5,
      x: 8,
      y: 11,
      w: 84,
      h: 0,
    }),
    text({
      text: PLACEHOLDER_DATES,
      placeholder: true,
      fontFamily: s.body,
      fontSize: 14,
      align: "center",
      color: s.muted,
      x: 20,
      y: 17.5,
      w: 60,
      h: 0,
    }),
    // One portrait, then the life around it — the board's whole job.
    window(26, 23, 48, 35),
    window(6, 61, 42, 16),
    window(52, 61, 42, 16),
    window(6, 79.5, 42, 16),
    window(52, 79.5, 42, 16),
  ];
}

/* ------------------------------------------------------------------ */
/* Memorial cards and their bookmarks — the photo-led set              */
/* ------------------------------------------------------------------ */

/*
 * The register real memorial cards are sold in: the person's photograph in a
 * round window with a ring, "Celebrating / the life of", the name in capitals
 * and the dates — set over a landscape, above a band of flowers, or beside a
 * cut-out spray. Every one has a bookmark twin of the same name, so a family
 * can order the pair. Card fronts are drawn in A5 units and scaled to A6 like
 * a borrowed cover; bookmarks are drawn in their own units.
 */

const WHITE = "#ffffff";

const celebrating = (s: TemplateStyle, color: string, y: number, fontSize: number, x = 8, w = 84) =>
  text({ text: "Celebrating", fontFamily: s.script, fontSize, align: "center", color, x, y, w, h: 0 });

const lifeOf = (s: TemplateStyle, color: string, y: number, fontSize: number, x = 15, w = 70) =>
  text({
    text: "the life of",
    fontFamily: s.body,
    fontSize,
    align: "center",
    color,
    uppercase: true,
    letterSpacing: fontSize / 3.5,
    x,
    y,
    w,
    h: 0,
  });

const nameLine = (
  s: TemplateStyle,
  color: string,
  y: number,
  fontSize: number,
  { x = 8, w = 84, script = false } = {},
) =>
  text({
    text: PLACEHOLDER_NAME,
    placeholder: true,
    fontFamily: script ? s.script : s.heading,
    fontSize,
    align: "center",
    color,
    uppercase: !script,
    letterSpacing: script ? undefined : fontSize / 16,
    x,
    y,
    w,
    h: 0,
  });

const datesLine = (s: TemplateStyle, color: string, y: number, fontSize: number, x = 20, w = 60) =>
  text({
    text: PLACEHOLDER_DATES,
    placeholder: true,
    fontFamily: s.body,
    fontSize,
    align: "center",
    color,
    x,
    y,
    w,
    h: 0,
  });

/** A round portrait with a ring, `w` percent of an A-series page wide. */
const ringedPortrait = (x: number, y: number, w: number, ring: string) =>
  photo({ shape: "oval", x, y, w, h: squareH(w), border: "single", borderColor: ring });

/**
 * The card's back: the farewell, a verse, and the name and dates again — on
 * plain paper whatever the front, because a verse set over a photograph is
 * unreadable at A6.
 */
function cardBack(s: TemplateStyle, spraySrc?: string): CanvasElement[] {
  return [
    spraySrc
      ? sprayElement(spraySrc, { x: 35, y: 8, w: 30, h: 18 })
      : motif(s.icon, s.accent, 45, 14, 10, squareH(10)),
    text({
      text: FAREWELL,
      fontFamily: s.script,
      fontSize: 30,
      align: "center",
      color: s.accent,
      x: 10,
      y: 30,
      w: 80,
      h: 0,
    }),
    text({
      text: VERSE,
      fontFamily: s.body,
      fontSize: 13,
      italic: true,
      align: "center",
      color: s.muted,
      x: 12,
      y: 40,
      w: 76,
      h: 0,
    }),
    rule(s.accent, 40, 62, 20, 0.4),
    nameLine(s, s.ink, 65, 17),
    datesLine(s, s.muted, 70.5, 11),
  ];
}

const CARD_FRONTS: Record<
  "card-scene" | "card-band" | "card-stem" | "card-corner" | "card-flutter" | "card-branch",
  (s: TemplateStyle, art: string, trim: PageTrim) => CanvasElement[]
> = {
  /**
   * A landscape across the whole card, white type on it. The render shades
   * the top and bottom edges, so the words sit there and the middle of the
   * picture stays clear between the portrait and the name.
   */
  "card-scene": (s, background, trim) => [
    backgroundElement(background, trim),
    celebrating(s, WHITE, 4, 38),
    lifeOf(s, WHITE, 12.5, 10),
    ringedPortrait(28, 18, 44, WHITE),
    nameLine(s, WHITE, 64, 24),
    datesLine(s, WHITE, 70.5, 12),
  ],
  /** Flowers along the foot (the background's band), everything above them. */
  "card-band": (s, background, trim) => [
    backgroundElement(background, trim),
    celebrating(s, s.accent, 3.5, 34),
    lifeOf(s, s.muted, 11.5, 10),
    ringedPortrait(30, 15, 40, s.accent),
    nameLine(s, s.ink, 45.5, 21),
    datesLine(s, s.muted, 50.5, 11),
  ],
  /** A tall stem rising up the left edge, the portrait and a script name beside it. */
  "card-stem": (s, spray) => [
    sprayElement(spray, { x: -5, y: 24, w: 46, h: 78 }),
    celebrating(s, s.accent, 5, 34, 30, 66),
    lifeOf(s, s.muted, 13, 10, 33, 60),
    ringedPortrait(40, 17.5, 46, s.accent),
    nameLine(s, s.accent, 53, 30, { x: 34, w: 62, script: true }),
    datesLine(s, s.muted, 62, 11, 38, 54),
  ],
  /** A specimen standing in the bottom-right corner, the type in the column left of it. */
  "card-corner": (s, spray) => [
    sprayElement(spray, { x: 58, y: 34, w: 44, h: 68 }),
    text({
      // Sized for the widest script (Petit Formal) to hold it on one line.
      text: "Celebrating the life of",
      fontFamily: s.script,
      fontSize: 24,
      align: "center",
      color: s.accent,
      x: 1,
      y: 6.5,
      w: 66,
      h: 0,
    }),
    ringedPortrait(13, 14, 40, s.accent),
    text({
      text: PLACEHOLDER_NAME,
      placeholder: true,
      fontFamily: s.heading,
      fontSize: 22,
      align: "center",
      color: s.ink,
      x: 2,
      y: 47,
      w: 62,
      h: 0,
    }),
    datesLine(s, s.muted, 53, 11, 6, 54),
  ],
  /**
   * A fine frame, the portrait at the top with a small creature on its ring
   * and a second in the frame's bottom corner — butterflies, or a robin.
   */
  "card-flutter": (s, spray) => [
    frame("single", s.accent, 6, 4, 88, 92),
    ringedPortrait(27, 9, 46, s.accent),
    sprayElement(spray, { x: 16, y: 31, w: 20, h: 13 }, -20),
    celebrating(s, s.accent, 45, 34),
    lifeOf(s, s.muted, 53, 10),
    nameLine(s, s.ink, 57, 21),
    datesLine(s, s.muted, 63, 11),
    sprayElement(spray, { x: 68, y: 77, w: 22, h: 15 }, 15),
  ],
  /**
   * A flowering branch hanging in from the top-right corner over a coloured
   * frame, a sprig of it at the photograph's corner. The branch is drawn
   * upright, so it's turned: 225° points its tip down and left, into the page.
   */
  "card-branch": (s, spray) => [
    frame("single", s.accent, 7, 5, 86, 90),
    sprayElement(spray, { x: 64, y: -10, w: 32, h: 42 }, 225),
    text({
      text: "In loving memory of",
      fontFamily: s.script,
      fontSize: 28,
      align: "center",
      color: s.accent,
      x: 7,
      y: 10,
      w: 66,
      h: 0,
    }),
    photo({ x: 29, y: 18, w: 42, h: 31, border: "single", borderColor: s.accent }),
    sprayElement(spray, { x: 17, y: 40, w: 15, h: 20 }, 45),
    nameLine(s, s.ink, 54, 21),
    datesLine(s, s.muted, 60, 11),
  ],
};

/** A round portrait on a bookmark — round on the page, so its height is a quarter of its width. */
const bookmarkPortrait = (x: number, y: number, w: number, ring: string, trim: PageTrim) =>
  photo({ shape: "oval", x, y, w, h: bookmarkSquareH(w, trim), border: "single", borderColor: ring });

function bookmarkSetPages(
  archetype: "bookmark-scene" | "bookmark-band" | "bookmark-bloom" | "bookmark-flutter",
  s: TemplateStyle,
  art: string,
  trim: PageTrim,
): DesignPage[] {
  switch (archetype) {
    case "bookmark-scene":
      return [
        page(s.paper, [
          backgroundElement(art, trim),
          celebrating(s, WHITE, 3, 19, 4, 92),
          lifeOf(s, WHITE, 8, 7.5, 6, 88),
          bookmarkPortrait(14, 11.5, 72, WHITE, trim),
          nameLine(s, WHITE, 70, 13, { x: 4, w: 92 }),
          datesLine(s, WHITE, 76.5, 9, 8, 84),
          text({
            text: FAREWELL,
            fontFamily: s.script,
            fontSize: 12,
            align: "center",
            color: WHITE,
            x: 4,
            y: 86,
            w: 92,
            h: 0,
          }),
        ]),
        page(s.paper, bookmarkBack(s, false)),
      ];
    case "bookmark-band":
      return [
        page(s.paper, [
          backgroundElement(art, trim),
          celebrating(s, s.accent, 4, 18, 4, 92),
          lifeOf(s, s.muted, 9, 7.5, 6, 88),
          bookmarkPortrait(15, 12.5, 70, s.accent, trim),
          nameLine(s, s.ink, 33, 13, { x: 4, w: 92 }),
          rule(s.accent, 35, 39, 30, 0.15),
          datesLine(s, s.muted, 40.5, 9, 8, 84),
          text({
            text: FAREWELL,
            fontFamily: s.script,
            fontSize: 12,
            align: "center",
            color: s.accent,
            x: 4,
            y: 47,
            w: 92,
            h: 0,
          }),
        ]),
        page(s.paper, bookmarkBack(s, false)),
      ];
    case "bookmark-bloom":
      return [
        page(s.paper, [
          frame("single", s.accent, 6, 2, 88, 96),
          celebrating(s, s.accent, 4.5, 17, 8, 84),
          lifeOf(s, s.muted, 9.5, 7.5, 8, 84),
          bookmarkPortrait(16, 13, 68, s.accent, trim),
          nameLine(s, s.ink, 33, 13, { x: 8, w: 84 }),
          rule(s.accent, 35, 39, 30, 0.15),
          datesLine(s, s.muted, 40.5, 9, 10, 80),
          // Down to the frame's bottom line, so a plate cut off at the stem stands on it.
          sprayElement(art, { x: 10, y: 47, w: 80, h: 51 }),
        ]),
        page(s.paper, bookmarkBack(s, false, art)),
      ];
    case "bookmark-flutter":
      return [
        page(s.paper, [
          frame("single", s.accent, 6, 2, 88, 96),
          bookmarkPortrait(16, 6, 68, s.accent, trim),
          sprayElement(art, { x: 6, y: 19, w: 30, h: 7 }, -20),
          celebrating(s, s.accent, 26, 17, 8, 84),
          lifeOf(s, s.muted, 31, 7.5, 8, 84),
          nameLine(s, s.ink, 34.5, 13, { x: 8, w: 84 }),
          rule(s.accent, 35, 40.5, 30, 0.15),
          datesLine(s, s.muted, 42, 9, 10, 80),
          text({
            text: VERSE,
            fontFamily: s.body,
            fontSize: 8.5,
            italic: true,
            align: "center",
            color: s.muted,
            x: 10,
            y: 50,
            w: 80,
            h: 0,
          }),
          sprayElement(art, { x: 50, y: 84, w: 40, h: 10 }, 15),
        ]),
        page(s.paper, bookmarkBack(s, false, art)),
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Scaling and assembly                                                */
/* ------------------------------------------------------------------ */

/**
 * Scale A5-unit content to another A size: only type and rules change, since
 * every position is already a percentage. Frames keep their line widths —
 * they're a hairline at any size.
 */
function scaleToTrim(pages: DesignPage[], trim: PageTrim): DesignPage[] {
  if (!isAsize(trim)) {
    throw new Error(`${trim.widthMm} × ${trim.heightMm} mm is not an A size`);
  }
  const factor = trim.widthMm / A5_TRIM.widthMm;
  const round = (value: number) => Math.round(value * factor * 2) / 2;
  return pages.map((source) => ({
    ...source,
    elements: source.elements.map((element) => {
      if (element.type === "text") {
        return {
          ...element,
          fontSize: round(element.fontSize),
          letterSpacing: element.letterSpacing === undefined ? undefined : round(element.letterSpacing),
        };
      }
      if (element.type === "shape") return { ...element, strokeWidth: round(element.strokeWidth) };
      return element;
    }),
  }));
}

/** A card or a board has no service on it — that's the booklet's job. */
const withoutServiceDetails = (source: DesignPage): DesignPage => ({
  ...source,
  elements: source.elements.filter(
    (element) => !(element.type === "text" && element.text === PLACEHOLDER_SERVICE),
  ),
});

function requireSpray(src: string | undefined): string {
  if (!src) throw new Error("This archetype needs a spray (sprayUrl)");
  return src;
}

const BACKGROUND_ARCHETYPES: ReadonlySet<string> = new Set([
  "card-scene",
  "card-band",
  "bookmark-scene",
  "bookmark-band",
]);

const OWN_SPRAY_ARCHETYPES: ReadonlySet<string> = new Set([
  "thanks-spray",
  "bookmark-spray",
  "card-stem",
  "card-corner",
  "card-flutter",
  "card-branch",
  "bookmark-bloom",
  "bookmark-flutter",
]);

/** Whether a spec's archetype sets its type over a rendered background. */
export function flatSpecNeedsBackground(spec: Pick<FlatTemplateSpec, "archetype">): boolean {
  return BACKGROUND_ARCHETYPES.has(spec.archetype);
}

/** Which render of a background a flat product uses: a bookmark has its own. */
export function flatBackgroundFormat(spec: Pick<FlatTemplateSpec, "product">): BackgroundFormat {
  return spec.product === "bookmarks" ? "bookmark" : "a5";
}

/**
 * The background URL for a scene or band spec, refusing a background that
 * doesn't exist, wasn't rendered for the palette or the format, or whose
 * render the runner couldn't find.
 */
function requireBackground(spec: FlatTemplateSpec, url: string | undefined): string {
  const background = getBackgroundSpec(spec.background ?? "");
  if (!background) throw new Error(`Spec "${spec.slug}": unknown background "${spec.background}"`);
  if (!background.palettes.includes(spec.palette)) {
    throw new Error(`Spec "${spec.slug}": "${background.id}" is not rendered for palette "${spec.palette}"`);
  }
  if (flatBackgroundFormat(spec) === "bookmark" && !background.bookmark) {
    throw new Error(`Spec "${spec.slug}": "${background.id}" has no bookmark render`);
  }
  if (!url) throw new Error(`Spec "${spec.slug}" needs backgroundUrl — run npm run backgrounds:fetch first`);
  return url;
}

/** A spec's own composition, or a booklet cover borrowed for an A-series product. */
export function flatArchetypeFits(spec: Pick<FlatTemplateSpec, "archetype" | "product">): boolean {
  if (spec.archetype in OWN_ARCHETYPES) {
    return OWN_ARCHETYPES[spec.archetype as OwnArchetypeId] === spec.product;
  }
  // Booklet covers only suit a portrait A-series product with a memorial front.
  return spec.product === "memorial-cards" || spec.product === "memory-board";
}

function isOwnArchetype<K extends OwnArchetypeId>(
  archetype: string,
  ids: readonly K[],
): archetype is K {
  return (ids as readonly string[]).includes(archetype);
}

/**
 * Build a flat template's layout on `trim` (its product's). Returns exactly
 * FLAT_TEMPLATE_PAGES[spec.product] pages, so it satisfies parseLayoutPages
 * for that product.
 */
export function buildFlatTemplateLayout(
  spec: FlatTemplateSpec,
  trim: PageTrim,
  options: BuildFlatOptions = {},
): DesignPage[] {
  if (!flatArchetypeFits(spec)) {
    throw new Error(`"${spec.archetype}" is not a ${spec.product} composition`);
  }
  const s = styleOf(spec);
  const wanted = FLAT_TEMPLATE_PAGES[spec.product];
  let pages: DesignPage[];

  if (isOwnArchetype(spec.archetype, ["card-scene", "card-band"] as const)) {
    const art = requireBackground(spec, options.backgroundUrl);
    pages = scaleToTrim(
      [page(s.paper, CARD_FRONTS[spec.archetype](s, art, trim)), page(s.paper, cardBack(s))],
      trim,
    );
  } else if (
    isOwnArchetype(spec.archetype, ["card-stem", "card-corner", "card-flutter", "card-branch"] as const)
  ) {
    const art = requireSpray(options.sprayUrl);
    pages = scaleToTrim(
      [page(s.paper, CARD_FRONTS[spec.archetype](s, art, trim)), page(s.paper, cardBack(s, art))],
      trim,
    );
  } else if (isOwnArchetype(spec.archetype, ["bookmark-scene", "bookmark-band"] as const)) {
    pages = bookmarkSetPages(spec.archetype, s, requireBackground(spec, options.backgroundUrl), trim);
  } else if (isOwnArchetype(spec.archetype, ["bookmark-bloom", "bookmark-flutter"] as const)) {
    pages = bookmarkSetPages(spec.archetype, s, requireSpray(options.sprayUrl), trim);
  } else if (spec.archetype === "bookmark-photo" || spec.archetype === "bookmark-solid" || spec.archetype === "bookmark-spray") {
    pages = bookmarkPages(spec.archetype, s, trim, options.sprayUrl);
  } else if (spec.archetype === "thanks-script" || spec.archetype === "thanks-photo" || spec.archetype === "thanks-spray") {
    pages = scaleToTrim(
      [
        page(s.paper, THANK_YOU_FRONTS[spec.archetype](s, options.sprayUrl)),
        page(s.paper, thankYouBack(s)),
      ],
      trim,
    );
  } else if (spec.archetype === "board-collage") {
    pages = scaleToTrim([page(s.paper, boardCollage(s))], trim);
  } else {
    // A booklet cover: build the booklet, keep its cover and back page.
    const booklet = buildTemplateLayout(
      {
        slug: spec.slug,
        name: spec.name,
        archetype: spec.archetype,
        palette: spec.palette,
        typeSet: spec.typeSet,
        icon: spec.icon,
        categories: spec.categories,
        ...(spec.spray ? { background: spec.spray } : {}),
      },
      { sprayUrl: options.sprayUrl },
    );
    const [cover, , back] = booklet;
    pages = scaleToTrim([withoutServiceDetails(cover), back].slice(0, wanted), trim);
  }

  if (pages.length !== wanted) {
    throw new Error(`Expected ${wanted} pages for ${spec.product}, built ${pages.length}`);
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* The curated list                                                    */
/* ------------------------------------------------------------------ */

/** Slug prefixes — template slugs are global, and these names repeat across products. */
const SLUG_PREFIX: Record<FlatProductId, string> = {
  "memorial-cards": "memorial-card",
  "thank-you-cards": "thank-you",
  bookmarks: "bookmark",
  "memory-board": "memory-board",
};

/**
 * Hand-picked, like the booklet library — a few per product, each visibly
 * different at thumbnail size. Spray ids are cutouts already rendered for the
 * booklet library (see CURATED_ARTWORK), so no new artwork has to be fetched.
 */
const CURATED_FLAT: Array<
  [
    product: FlatProductId,
    name: string,
    archetype: FlatTemplateSpec["archetype"],
    palette: PaletteId,
    typeSet: TypeSetId,
    icon: string,
    categories: string[],
    spray?: string,
  ]
> = [
  ["memorial-cards", "Quiet Frame", "framed", "plum", "cormorant", "flower", ["classic", "floral"]],
  ["memorial-cards", "Remembered", "portrait", "slate", "garamond", "leaf", ["modern", "simple"]],
  ["memorial-cards", "Gentle Arch", "arch", "forest", "playfair", "leaf", ["nature", "calm"]],
  ["memorial-cards", "Josephine Rose", "keepsake", "plum", "cormorant", "flower", ["floral", "classic"], "redoute-frankfort-rose"],
  ["memorial-cards", "Martagon Lily", "portrait-corners", "bronze", "garamond", "flower", ["floral", "classic"], "redoute-martagon-lily"],

  ["thank-you-cards", "With Thanks", "thanks-script", "plum", "classic", "heart", ["classic", "simple"]],
  ["thank-you-cards", "Grateful Hearts", "thanks-photo", "forest", "garamond", "leaf", ["nature", "calm"]],
  ["thank-you-cards", "Burgundy Rose", "thanks-spray", "plum", "playfair", "flower", ["floral", "classic"], "redoute-burgundy-rose"],
  ["thank-you-cards", "Heather", "thanks-spray", "stone", "cormorant", "leaf", ["nature", "calm"], "redoute-erica"],

  ["bookmarks", "Evergreen", "bookmark-photo", "forest", "classic", "leaf", ["nature", "simple"]],
  ["bookmarks", "Plum Ribbon", "bookmark-photo", "plum", "cormorant", "flower", ["classic", "floral"]],
  ["bookmarks", "Midnight", "bookmark-solid", "slate", "playfair", "star", ["modern", "calm"]],
  ["bookmarks", "Climbing Lily", "bookmark-spray", "plum", "prata", "flower", ["floral", "colourful"], "redoute-climbing-lily"],

  ["memory-board", "Life in Pictures", "board-collage", "plum", "cormorant", "flower", ["classic"]],
  ["memory-board", "Family Album", "board-collage", "forest", "garamond", "leaf", ["nature", "calm"]],
  ["memory-board", "Welcome Portrait", "portrait", "slate", "playfair", "leaf", ["modern", "simple"]],
  ["memory-board", "Framed Memory", "framed", "bronze", "classic", "flower", ["classic", "religious"]],
  ["memory-board", "Rose Welcome", "keepsake", "plum", "playfair", "flower", ["floral", "classic"], "redoute-burgundy-rose"],
];

/**
 * The memorial card set: each design is built twice, as an A6 card and as a
 * bookmark of the same name, so the two can be ordered as a pair. `art` is a
 * background id for the scene and band compositions, or a spray id for the
 * cutout ones; solid ones need neither. Scenes use the `ink` palette — the
 * photograph carries the colour, and the type over it is white.
 */
const MEMORIAL_SET: Array<
  [
    name: string,
    card: FlatTemplateSpec["archetype"],
    bookmark: FlatTemplateSpec["archetype"],
    palette: PaletteId,
    typeSet: TypeSetId,
    icon: string,
    categories: string[],
    art?: string,
  ]
> = [
  // Over a landscape.
  ["Lakeside Sunset", "card-scene", "bookmark-scene", "ink", "classic", "sun", ["nature", "calm"], "lake-sunset"],
  ["Still Waters", "card-scene", "bookmark-scene", "ink", "playfair", "feather", ["nature", "calm", "modern"], "twilight-lake"],
  ["The Jetty", "card-scene", "bookmark-scene", "ink", "cormorant", "sun", ["nature", "calm"], "lake-jetty"],
  ["Countryside", "card-scene", "bookmark-scene", "ink", "garamond", "leaf", ["nature", "colourful"], "countryside-sunset"],
  ["Misty Dawn", "card-scene", "bookmark-scene", "ink", "baskerville", "tree", ["nature", "calm"], "country-dawn"],
  ["Harvest Evening", "card-scene", "bookmark-scene", "ink", "prata", "sun", ["nature", "colourful"], "hay-bales"],
  ["Golden Wheat", "card-scene", "bookmark-scene", "ink", "classic", "leaf", ["nature", "religious"], "wheat-sunset"],
  ["Over the Rainbow", "card-scene", "bookmark-scene", "ink", "playfair", "sun", ["colourful", "nature"], "rainbow-meadow"],
  ["Steam Railway", "card-scene", "bookmark-scene", "ink", "classic", "star", ["sport", "nature"], "steam-viaduct"],
  ["Sunset Shore", "card-scene", "bookmark-scene", "ink", "cormorant", "feather", ["calm", "nature"], "beach-sunset"],
  // Above a band of flowers.
  ["Sunflowers", "card-band", "bookmark-band", "bronze", "garamond", "sun", ["floral", "colourful"], "sunflower-band"],
  ["Poppies", "card-band", "bookmark-band", "wine", "classic", "flower", ["floral", "colourful"], "poppy-band"],
  ["Spring Crocus", "card-band", "bookmark-band", "violet", "cormorant", "flower", ["floral", "nature"], "crocus-meadow"],
  ["Blush Roses", "card-band", "bookmark-band", "rose", "playfair", "heart", ["floral", "calm"], "pastel-rose-band"],
  // Beside a cut-out spray.
  ["Daffodils", "card-stem", "bookmark-bloom", "bronze", "playfair", "flower", ["floral", "colourful"], "redoute-daffodil"],
  ["Golden Sunflower", "card-stem", "bookmark-bloom", "bronze", "cormorant", "sun", ["floral", "colourful"], "ishizaki-sunflower"],
  ["Lily and Butterflies", "card-stem", "bookmark-bloom", "plum", "playfair", "flower", ["floral", "nature"], "rijks-lily-butterflies"],
  ["Bluebells", "card-corner", "bookmark-bloom", "blue", "classic", "flower", ["floral", "nature"], "flora-batava-bluebell"],
  ["Scottish Thistle", "card-corner", "bookmark-bloom", "plum", "cormorant", "leaf", ["nature", "classic"], "thome-thistle"],
  ["Wild Poppy", "card-corner", "bookmark-bloom", "wine", "garamond", "flower", ["floral", "colourful"], "american-flora-poppy"],
  ["Butterflies", "card-flutter", "bookmark-flutter", "slate", "prata", "feather", ["nature", "calm"], "rijks-blue-butterfly"],
  ["Robin Redbreast", "card-flutter", "bookmark-flutter", "wine", "baskerville", "bird", ["birds", "nature"], "sydney-robin"],
  ["Blossom Branch", "card-branch", "bookmark-bloom", "rose", "classic", "flower", ["floral", "colourful"], "rijks-quince-branch"],
  // On a deep colour.
  ["Royal Blue", "solid-frame", "bookmark-solid", "blue", "classic", "star", ["classic", "simple"]],
];

const flatSpec = (
  product: FlatProductId,
  name: string,
  archetype: FlatTemplateSpec["archetype"],
  palette: PaletteId,
  typeSet: TypeSetId,
  icon: string,
  categories: string[],
  art: { spray?: string; background?: string } = {},
): FlatTemplateSpec => ({
  slug: `${SLUG_PREFIX[product]}-${slugForName(name)}`,
  name,
  product,
  archetype,
  palette,
  typeSet,
  icon,
  categories,
  ...(art.spray ? { spray: art.spray } : {}),
  ...(art.background ? { background: art.background } : {}),
});

/** A set entry's art, as the spray or the background its archetype takes. */
const artFor = (archetype: FlatTemplateSpec["archetype"], art: string | undefined) =>
  !art ? {} : flatSpecNeedsBackground({ archetype }) ? { background: art } : { spray: art };

export const FLAT_TEMPLATE_SPECS: FlatTemplateSpec[] = [
  ...CURATED_FLAT.map(([product, name, archetype, palette, typeSet, icon, categories, spray]) =>
    flatSpec(product, name, archetype, palette, typeSet, icon, categories, { spray }),
  ),
  ...MEMORIAL_SET.flatMap(([name, card, bookmark, palette, typeSet, icon, categories, art]) => [
    flatSpec("memorial-cards", name, card, palette, typeSet, icon, categories, artFor(card, art)),
    flatSpec("bookmarks", name, bookmark, palette, typeSet, icon, categories, artFor(bookmark, art)),
  ]),
];

/** Whether a spec's archetype needs a spray cutout. */
export function flatSpecNeedsSpray(spec: Pick<FlatTemplateSpec, "archetype">): boolean {
  return OWN_SPRAY_ARCHETYPES.has(spec.archetype) || isSprayArchetype(spec.archetype);
}

/** Every archetype id a flat spec may use — for tests. */
export const FLAT_ARCHETYPE_IDS: readonly string[] = [
  ...ARCHETYPE_IDS,
  ...SPRAY_ARCHETYPE_IDS,
  ...SOLID_ARCHETYPE_IDS,
  ...Object.keys(OWN_ARCHETYPES),
];
