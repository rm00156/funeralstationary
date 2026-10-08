/**
 * Fetches the business's Google reviews from the Places API (New), fresh on
 * every call: Google's terms allow storing nothing but the place ID, so there
 * is deliberately no cache here, in Next's fetch cache or at the CDN. The
 * rules for what is shown live in googleReviews.ts.
 *
 * GOOGLE_PLACES_API_KEY is server-only; restrict it to the Places API in
 * Google Cloud and give it a daily quota there, which is the hard ceiling on
 * cost (each call is a Place Details Enterprise + Atmosphere request).
 */
import { parseGoogleReviews, type GoogleReviewsData } from "@/lib/googleReviews";
import { GOOGLE_REVIEWS } from "@/lib/site";

const FIELDS = "rating,userRatingCount,googleMapsUri,reviews";

export function isGoogleReviewsConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

/** Null when unconfigured or Google doesn't answer — the section then shows no review cards. */
export async function fetchGoogleReviews(): Promise<GoogleReviewsData | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${GOOGLE_REVIEWS.placeId}?languageCode=en-GB&regionCode=GB`,
      {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) {
      console.error(`Google reviews: Places API answered ${response.status}`);
      return null;
    }
    return parseGoogleReviews(await response.json());
  } catch (error) {
    console.error("Google reviews: Places API unreachable", error);
    return null;
  }
}
