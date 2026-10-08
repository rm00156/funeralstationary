/**
 * The business's own facts — phone, hours, address, cut-off, review figures —
 * in one place, so the utility bar, footer, help band, contact page and the
 * delivery copy can never disagree. Several of these are still open questions
 * for the owner (see funeral-stationery-handoff/HANDOFF.md, "Content: open
 * questions"); change them here and every page follows.
 */

export const SITE_NAME = "The Funeral Stationery";

export const PHONE_DISPLAY = "020 7277 7663";
export const PHONE_HREF = "tel:02072777663";

export const EMAIL = "info@thefuneralstationery.co.uk";
export const EMAIL_HREF = `mailto:${EMAIL}`;

export const OPENING_HOURS = "Mon–Fri 9am–6pm";
export const OPENING_HOURS_LONG = "Monday to Friday, 9am–6pm";

export const COMPANY_NAME = "Bluwave Ltd";
export const ADDRESS_LINES = [
  "Unit 4, Gardner Industrial Estate",
  "Kent House Lane, Beckenham BR3 1QZ",
] as const;
export const ADDRESS_TOWN = "Beckenham";

/** Order cut-off for next-working-day delivery. */
export const ORDER_CUTOFF = "10am";
export const STANDARD_TURNAROUND = "24–72 hours";

/**
 * The Trustpilot profile. There is deliberately no TrustScore here: on the
 * free plan Trustpilot's brand guidelines allow it only through their own
 * badge (TrustpilotBadge.tsx), never typed. The review count is the badge's
 * fallback text, for when Trustpilot's script is blocked — update it when the
 * profile moves.
 */
export const TRUSTPILOT = {
  /** The profile's id, which Trustpilot's badge (Testimonials) is drawn for. */
  businessUnitId: "5c8eb780df266400012deb11",
  reviewCount: 164,
  profileUrl: "https://uk.trustpilot.com/review/thefuneralstationery.co.uk",
  writeReviewUrl: "https://uk.trustpilot.com/evaluate/thefuneralstationery.co.uk",
} as const;

/**
 * The Google Business Profile. Trustpilot holds the review history, so it is
 * what the site displays; new reviews are asked for on Google, where they show
 * up in Search and Maps. The place id is the listing at the Beckenham unit.
 */
const GOOGLE_PLACE_ID = "ChIJTTwk2_IDdkgRuLe1ni5HoQQ";
export const GOOGLE_REVIEWS = {
  /** What the home page's live Google reviews are fetched for (googleReviews.server.ts). */
  placeId: GOOGLE_PLACE_ID,
  profileUrl: `https://www.google.com/maps/place/?q=place_id:${GOOGLE_PLACE_ID}`,
  writeReviewUrl: `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`,
} as const;

/**
 * The two ways to order that aren't a template in the catalogue. "We design
 * it for you" is handled by a person, so it leads to the contact page with
 * the topic already chosen (see CONTACT_TOPICS in contact.ts); "Upload your
 * own design" is the /upload flow, which prints the customer's own PDF.
 */
export const DESIGN_FOR_YOU_HREF = "/contact?topic=design-for-me";
export const UPLOAD_DESIGN_HREF = "/upload";
