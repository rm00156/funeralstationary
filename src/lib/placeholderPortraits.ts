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

import type { DesignPage } from "@/lib/designEditor";

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
export const PLACEHOLDER_PORTRAIT_IDS = [...MONO_PORTRAIT_IDS, ...COLOUR_PORTRAIT_IDS] as const;

export type PlaceholderPortraitId = (typeof PLACEHOLDER_PORTRAIT_IDS)[number];

export function isPlaceholderPortraitId(value: unknown): value is PlaceholderPortraitId {
  return (PLACEHOLDER_PORTRAIT_IDS as readonly unknown[]).includes(value);
}

export function placeholderPortraitKey(id: PlaceholderPortraitId): string {
  return `templates/placeholders/${id}.webp`;
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
 */
export function withPlaceholderPhotos(
  page: DesignPage,
  src: string | readonly string[],
): DesignPage {
  const sources = typeof src === "string" ? [src] : src;
  if (sources.length === 0) return page;
  let filled = 0;
  return {
    ...page,
    elements: page.elements.map((element) =>
      element.type === "image" && element.src === null
        ? { ...element, src: sources[filled++ % sources.length] }
        : element,
    ),
  };
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
    ? (MONO_PORTRAIT_IDS as readonly PlaceholderPortraitId[]).includes(pick)
      ? MONO_PORTRAIT_IDS
      : COLOUR_PORTRAIT_IDS
    : portraitSetForPage(cover);
  const start = set.indexOf(pick ?? portraitIdForSeed(seed, set));
  return set.map((_, i) => set[(start + i) % set.length]);
}
