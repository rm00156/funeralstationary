/**
 * Google reviews for the home page's "From families we've helped" section —
 * the parsing of a Places API (New) Place Details response and the rules for
 * what is shown. Pure, so it unit-tests; googleReviews.server.ts fetches.
 *
 * Google's Places policies shape all of it:
 * - Nothing but the place ID may be cached or stored, so the reviews are
 *   fetched fresh on each view (the section asks only when it is scrolled
 *   near, which keeps the per-call cost to visitors who reach it).
 * - Every review carries its author's attribution — photo, name, profile
 *   link — and the section links the listing on Google Maps and credits
 *   "Google Maps", since there is no Google map beside it.
 * - Reviews are shown as Google returns them (its "most relevant" five),
 *   unfiltered and in its order, and the page says so.
 */

/** The overall Google rating is only shown once it rests on this many reviews. */
export const GOOGLE_RATING_MIN_REVIEWS = 10;
/** Google returns at most five reviews; never show more. */
export const GOOGLE_REVIEWS_MAX = 5;

export interface GoogleReview {
  /** 1–5 whole stars. */
  rating: number;
  text: string;
  /** "6 months ago" — Google's own wording. */
  relativeTime: string;
  authorName: string;
  authorUrl: string | null;
  authorPhotoUrl: string | null;
  /** The review itself on Google Maps — Google requires a way through to it from every review. */
  reviewUrl: string | null;
}

export interface GoogleReviewsData {
  /** Null below GOOGLE_RATING_MIN_REVIEWS, so one five-star review can't read as a "5.0" headline. */
  rating: number | null;
  reviewCount: number;
  /** The listing on Google Maps — the required link to the source. */
  mapsUrl: string | null;
  reviews: GoogleReview[];
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
/** Only https links from Google's response reach an href or src. */
const httpsUrl = (value: unknown): string | null => {
  const url = text(value);
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

/** Turns a Place Details response into what the section shows, dropping anything malformed. */
export function parseGoogleReviews(body: unknown): GoogleReviewsData {
  const place = record(body);
  const reviewCount =
    typeof place.userRatingCount === "number" && place.userRatingCount >= 0
      ? Math.floor(place.userRatingCount)
      : 0;
  const rating =
    typeof place.rating === "number" && reviewCount >= GOOGLE_RATING_MIN_REVIEWS
      ? Math.round(place.rating * 10) / 10
      : null;

  const reviews: GoogleReview[] = [];
  for (const raw of Array.isArray(place.reviews) ? place.reviews : []) {
    const review = record(raw);
    const author = record(review.authorAttribution);
    // Prefer the words as written; `text` may be Google's translation.
    const words = text(record(review.originalText).text) ?? text(record(review.text).text);
    const authorName = text(author.displayName);
    const stars = typeof review.rating === "number" ? Math.round(review.rating) : NaN;
    if (!words || !authorName || !(stars >= 1 && stars <= 5)) continue;
    reviews.push({
      rating: stars,
      text: words,
      relativeTime: text(review.relativePublishTimeDescription) ?? "",
      authorName,
      authorUrl: httpsUrl(author.uri),
      authorPhotoUrl: httpsUrl(author.photoUri),
      reviewUrl: httpsUrl(review.googleMapsUri),
    });
    if (reviews.length === GOOGLE_REVIEWS_MAX) break;
  }

  return { rating, reviewCount, mapsUrl: httpsUrl(place.googleMapsUri), reviews };
}

/**
 * How the section lays out however many reviews Google returned: one review
 * is featured beside the heading rather than left as a lone card in a row
 * built for several; two or more go in a carousel under it.
 */
export type ReviewsLayout = "none" | "featured" | "carousel";

export function reviewsLayout(count: number): ReviewsLayout {
  if (count <= 0) return "none";
  return count === 1 ? "featured" : "carousel";
}

/** The carousel's counter: "1–3 of 5". `first` is the zero-based index of the first card in view. */
export function carouselLabel(first: number, perPage: number, total: number): string {
  const start = Math.min(Math.max(first, 0), Math.max(total - 1, 0));
  const end = Math.min(start + Math.max(perPage, 1), total);
  return end - start <= 1 ? `${start + 1} of ${total}` : `${start + 1}–${end} of ${total}`;
}
