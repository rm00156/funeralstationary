/**
 * Stand-in portraits for template *previews*.
 *
 * A template's photo windows are deliberately empty (`ImageElement.src` is
 * null) so the customer drops their own photograph in. That is right for the
 * editor and wrong for a thumbnail: an empty dashed box tells a browsing
 * customer nothing about how the design reads, and every competitor shows a
 * finished card.
 *
 * So the substitution happens at thumbnail-render time only — see
 * `renderTemplateThumbnail`. The stored layout keeps its nulls, because a
 * saved template carrying a stranger's face could be ordered as-is, and on
 * this product that is not a defect anyone would forgive.
 *
 * Pure and DB-free, same discipline as templateGenerator.ts.
 */

import type { DesignPage, PhotoCrop } from "@/lib/designEditor";

/**
 * Two sets, matched to the cover rather than dealt out evenly. Black-and-white
 * suits a plain paper cover, where it reads as the classic printed keepsake;
 * on a cover that already carries colour artwork — a flower band, a spray, a
 * landscape — a monochrome face looks pasted in, so those get colour.
 */
export const MONO_PORTRAIT_IDS = ["portrait-1", "portrait-2", "portrait-3"] as const;
export const COLOUR_PORTRAIT_IDS = [
  "portrait-4",
  "portrait-5",
  "portrait-6",
  "portrait-7",
  "portrait-8",
  "portrait-9",
] as const;
/**
 * Studio head-and-shoulders portraits on a plain grey ground, for the themed
 * covers. Pinned per template (and offered in the admin picker) rather than
 * dealt out automatically, so adding them didn't change any existing
 * template's face. Each has a recorded gender — see STUDIO_PORTRAIT_GENDER.
 */
export const STUDIO_PORTRAIT_IDS = [
  "portrait-10",
  "portrait-11",
  "portrait-12",
  "portrait-13",
  "portrait-14",
  "portrait-15",
  "portrait-16",
  "portrait-17",
  "portrait-18",
  "portrait-19",
  "portrait-20",
  "portrait-21",
] as const;

/**
 * Stand-ins that aren't adults: a baby for the child covers, and pets for the
 * pet covers. CC0 photographs from Wikimedia Commons (credits in
 * docs/placeholder-portrait-credits.md), pinned per template like the studio
 * set and never dealt out automatically.
 */
export const SUBJECT_PORTRAIT_IDS = [
  "portrait-22", // baby
  "portrait-23", // brown rabbit
  "portrait-24", // white rabbit
  "portrait-25", // dog
  "portrait-26", // cat
] as const;

/**
 * The studio set's twelve people again, older — the same faces in the same
 * order and clothes, aged to the years most of these booklets are for. Same
 * plain grey ground and the same alternating woman/man order, so a template
 * pinned to one studio portrait can move to its older twin without its
 * sample name changing. Pinned per template like the studio set (and offered
 * in the admin picker), never dealt out automatically.
 */
export const ELDER_PORTRAIT_IDS = [
  "portrait-27",
  "portrait-28",
  "portrait-29",
  "portrait-30",
  "portrait-31",
  "portrait-32",
  "portrait-33",
  "portrait-34",
  "portrait-35",
  "portrait-36",
  "portrait-37",
  "portrait-38",
] as const;

/**
 * One person's life for a photo collage, so its windows read as one person
 * rather than a row of strangers. The first of each set is them late in
 * life, for the large window; the rest is the life around it in order. His:
 * a boy on the step, a young man by his car, his wedding, a young father on
 * the beach, retired on the allotment. Hers: a girl at the gate, a young
 * woman on the promenade, her wedding, a young mother in the park, baking
 * in her kitchen. The photos are square scenes, each with its own crop
 * height (placeholderCrop) so the memory board's wide windows and a
 * booklet's squarer ones both frame it. Pinned per template: pin the lead
 * and the rotation fills the rest in order. Only the leads are offered in
 * the admin picker.
 */
export const HIS_LIFE_PORTRAIT_IDS = [
  "portrait-39",
  "portrait-40",
  "portrait-41",
  "portrait-42",
  "portrait-43",
  "portrait-44",
] as const;
export const HER_LIFE_PORTRAIT_IDS = [
  "portrait-45",
  "portrait-46",
  "portrait-47",
  "portrait-48",
  "portrait-49",
  "portrait-50",
] as const;

/** The life story sets, each with who it follows, for the admin picker. */
export const LIFE_STORIES = [
  { ids: HIS_LIFE_PORTRAIT_IDS, gender: "man" },
  { ids: HER_LIFE_PORTRAIT_IDS, gender: "woman" },
] as const;

export const PLACEHOLDER_PORTRAIT_IDS = [
  ...MONO_PORTRAIT_IDS,
  ...COLOUR_PORTRAIT_IDS,
  ...STUDIO_PORTRAIT_IDS,
  ...SUBJECT_PORTRAIT_IDS,
  ...ELDER_PORTRAIT_IDS,
  ...HIS_LIFE_PORTRAIT_IDS,
  ...HER_LIFE_PORTRAIT_IDS,
] as const;

export type PlaceholderPortraitId = (typeof PLACEHOLDER_PORTRAIT_IDS)[number];
export type StudioPortraitId = (typeof STUDIO_PORTRAIT_IDS)[number];
export type SubjectPortraitId = (typeof SUBJECT_PORTRAIT_IDS)[number];
export type ElderPortraitId = (typeof ELDER_PORTRAIT_IDS)[number];

/**
 * Who each studio portrait shows, so a template previewed with one carries a
 * matching name and wording ("husband" or "wife") — a man's face over a
 * woman's name reads as a mistake.
 */
export const STUDIO_PORTRAIT_GENDER: Record<StudioPortraitId, "woman" | "man"> = {
  "portrait-10": "woman",
  "portrait-11": "man",
  "portrait-12": "woman",
  "portrait-13": "man",
  "portrait-14": "woman",
  "portrait-15": "man",
  "portrait-16": "woman",
  "portrait-17": "man",
  "portrait-18": "woman",
  "portrait-19": "man",
  "portrait-20": "woman",
  "portrait-21": "man",
};

/** Who each older studio portrait shows; the same as its younger twin's. */
export const ELDER_PORTRAIT_GENDER: Record<ElderPortraitId, "woman" | "man"> = {
  "portrait-27": "woman",
  "portrait-28": "man",
  "portrait-29": "woman",
  "portrait-30": "man",
  "portrait-31": "woman",
  "portrait-32": "man",
  "portrait-33": "woman",
  "portrait-34": "man",
  "portrait-35": "woman",
  "portrait-36": "man",
  "portrait-37": "woman",
  "portrait-38": "man",
};

/** The sets a pick can belong to; a rotation stays inside its pick's set. */
const PORTRAIT_SETS: ReadonlyArray<readonly PlaceholderPortraitId[]> = [
  MONO_PORTRAIT_IDS,
  COLOUR_PORTRAIT_IDS,
  STUDIO_PORTRAIT_IDS,
  SUBJECT_PORTRAIT_IDS,
  ELDER_PORTRAIT_IDS,
  HIS_LIFE_PORTRAIT_IDS,
  HER_LIFE_PORTRAIT_IDS,
];

export function isPlaceholderPortraitId(value: unknown): value is PlaceholderPortraitId {
  return (PLACEHOLDER_PORTRAIT_IDS as readonly unknown[]).includes(value);
}

/**
 * Portraits redrawn since they were first uploaded, under a new key so a
 * thumbnail rendered from the old file keeps it. The automatic sets were
 * close-cropped headshots that touched a squarer window's frame; their `-v2`
 * files are the same people outpainted and re-cropped to a looser head and
 * shoulders (portrait-3 already had the room, so it keeps its file). The
 * pets' `-v2` files show the whole animal: the first rabbits and the cat were
 * close-ups cut off by their windows, so three are new CC0 photographs and
 * the dog is re-cropped from its own. Add to this, never overwrite a key in
 * place.
 */
const REFRAMED_PORTRAIT_IDS: ReadonlySet<PlaceholderPortraitId> = new Set([
  "portrait-1",
  "portrait-2",
  ...COLOUR_PORTRAIT_IDS,
  "portrait-23",
  "portrait-24",
  "portrait-25",
  "portrait-26",
]);

export function placeholderPortraitKey(id: PlaceholderPortraitId): string {
  return `templates/placeholders/${id}${REFRAMED_PORTRAIT_IDS.has(id) ? "-v2" : ""}.webp`;
}

/**
 * The set a cover's stand-ins come from. A collage takes the colour set too:
 * it is the larger, so its windows preview as a family rather than the same
 * three faces round again, and colour and monochrome side by side look mixed
 * up rather than chosen.
 */
export function portraitSetForPage(cover: DesignPage): readonly PlaceholderPortraitId[] {
  const images = cover.elements.filter((element) => element.type === "image");
  const collage = images.filter((element) => element.src === null).length > 1;
  return collage || images.some((element) => element.src !== null)
    ? COLOUR_PORTRAIT_IDS
    : MONO_PORTRAIT_IDS;
}

/**
 * Which portrait of a set a given template gets. Deterministic, so a
 * template's preview doesn't change face every time it is republished, and
 * spread across the set so a gallery isn't the same person twenty times over.
 */
export function portraitIdForSeed(
  seed: string,
  set: readonly PlaceholderPortraitId[] = PLACEHOLDER_PORTRAIT_IDS,
): PlaceholderPortraitId {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return set[hash % set.length];
}

/**
 * A copy of the page with every empty photo window filled. Elements that
 * already have a src — background washes, cutout sprays — are left alone, as
 * is the original page: this must never mutate what gets stored.
 *
 * Given several portraits, successive windows cycle through them, so a photo
 * collage previews as a family rather than the same face repeated.
 *
 * Each stand-in sits high in its window (PLACEHOLDER_CROP). The portraits are
 * 3:4 and most windows are squarer, so a centred crop takes its share off the
 * top and leaves the hair touching the frame. Pinned right to the top fails
 * the other way in a wide window — the board collage's 1.86:1 windows show
 * only hair down to the nose. A fifth of the way down keeps headroom in a
 * squarer window and the whole face in a wide one. A source can carry its
 * own crop instead (placeholderCrop), and a window with its own crop keeps it.
 */
export function withPlaceholderPhotos(
  page: DesignPage,
  src: PlaceholderSource | readonly PlaceholderSource[],
): DesignPage {
  const sources = (Array.isArray(src) ? src : [src]) as readonly PlaceholderSource[];
  if (sources.length === 0) return page;
  let filled = 0;
  return {
    ...page,
    elements: page.elements.map((element) => {
      if (element.type !== "image" || element.src !== null) return element;
      const source = sources[filled++ % sources.length];
      const { src: url, crop } = typeof source === "string" ? { src: source, crop: PLACEHOLDER_CROP } : source;
      return { ...element, src: url, crop: element.crop ?? crop };
    }),
  };
}

/** A stand-in's image URL, alone or with the crop it should sit at. */
export type PlaceholderSource = string | { src: string; crop: PhotoCrop };

/** Where a stand-in portrait sits in its window: centred across, high up. */
export const PLACEHOLDER_CROP: PhotoCrop = { x: 50, y: 20, zoom: 1 };

/**
 * The life story photos are square scenes, not head-and-shoulders portraits,
 * so each has its own height to sit at — chosen so a 1.86:1 window (the
 * memory board collage) shows the band with the face in it, while a squarer
 * window, which shows nearly the whole photo, barely moves. In a square
 * photo a 1.86:1 window shows 54% of the height, so `y` is the band's top
 * as a fraction of the photo divided by the 46% left over.
 */
const LIFE_PORTRAIT_CROP_Y: Partial<Record<PlaceholderPortraitId, number>> = {
  "portrait-40": 56, // the boy on the step sits low in the frame
  "portrait-41": 15,
  "portrait-42": 17,
  "portrait-43": 26,
  "portrait-44": 4,
  "portrait-46": 30,
  "portrait-47": 15,
  "portrait-48": 42,
  "portrait-49": 13,
  "portrait-50": 0,
};

/** The crop a stand-in portrait sits at: its own, or PLACEHOLDER_CROP. */
export function placeholderCrop(id: PlaceholderPortraitId): PhotoCrop {
  const y = LIFE_PORTRAIT_CROP_Y[id];
  return y === undefined ? PLACEHOLDER_CROP : { ...PLACEHOLDER_CROP, y };
}

/**
 * The portraits for a template's previews: the cover's set, ordered so
 * `seed`'s pick comes first. Every page of one template draws from its cover's
 * set, so the inside pages don't switch to a different kind of photograph.
 *
 * `chosen` is an admin's explicit pick (`templates.placeholder_portrait`). It
 * wins over the automatic set, so the rotation comes from the set the pick
 * belongs to and starts with it; null/unknown keeps the automatic behaviour.
 */
export function portraitRotationFor(
  cover: DesignPage,
  seed: string,
  chosen?: string | null,
): PlaceholderPortraitId[] {
  const pick = isPlaceholderPortraitId(chosen) ? chosen : null;
  const set = pick
    ? PORTRAIT_SETS.find((candidate) => candidate.includes(pick))!
    : portraitSetForPage(cover);
  const start = set.indexOf(pick ?? portraitIdForSeed(seed, set));
  return set.map((_, i) => set[(start + i) % set.length]);
}
