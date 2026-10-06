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
 * Trustpilot summary. These are a snapshot, not a live feed — update them
 * when the profile moves, or replace them with the official widget.
 */
export const TRUSTPILOT = {
  rating: "4.8",
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
  profileUrl: `https://www.google.com/maps/place/?q=place_id:${GOOGLE_PLACE_ID}`,
  writeReviewUrl: `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`,
} as const;

/** Real reviews carried over from the current site. Never invent more. */
export const FEATURED_REVIEWS = [
  {
    title: "Excellent service from start to finish",
    body: "The quality of the Order of Service was outstanding and delivered exactly when promised. Highly recommended during such a difficult time.",
    initials: "SP",
    name: "Sarah Pat",
    detail: "Verified buyer · Order of Service",
  },
  {
    title: "Very compassionate and professional",
    body: "The templates were easy to use, and the final print quality exceeded our expectations. A beautiful tribute for our loved one.",
    initials: "AK",
    name: "Alastair Kenward",
    detail: "Verified buyer",
  },
] as const;

/**
 * The two ways to order that aren't a template in the catalogue. "We design
 * it for you" is handled by a person, so it leads to the contact page with
 * the topic already chosen (see CONTACT_TOPICS in contact.ts); "Upload your
 * own design" is the /upload flow, which prints the customer's own PDF.
 */
export const DESIGN_FOR_YOU_HREF = "/contact?topic=design-for-me";
export const UPLOAD_DESIGN_HREF = "/upload";
