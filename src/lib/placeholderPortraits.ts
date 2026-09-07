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

export const PLACEHOLDER_PORTRAIT_IDS = ["portrait-1", "portrait-2", "portrait-3"] as const;

export type PlaceholderPortraitId = (typeof PLACEHOLDER_PORTRAIT_IDS)[number];

export function placeholderPortraitKey(id: PlaceholderPortraitId): string {
  return `templates/placeholders/${id}.jpg`;
}

/**
 * Which portrait a given template gets. Deterministic, so a template's
 * preview doesn't change face every time it is republished, and spread across
 * the set so a gallery isn't the same person twenty times over.
 */
export function portraitIdForSeed(seed: string): PlaceholderPortraitId {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_PORTRAIT_IDS[hash % PLACEHOLDER_PORTRAIT_IDS.length];
}

/**
 * A copy of the page with every empty photo window filled. Elements that
 * already have a src — background washes, cutout sprays — are left alone, as
 * is the original page: this must never mutate what gets stored.
 */
export function withPlaceholderPhotos(page: DesignPage, src: string): DesignPage {
  return {
    ...page,
    elements: page.elements.map((element) =>
      element.type === "image" && element.src === null ? { ...element, src } : element,
    ),
  };
}
