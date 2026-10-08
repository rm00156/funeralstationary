import { describe, expect, it } from "vitest";

import {
  carouselLabel,
  GOOGLE_RATING_MIN_REVIEWS,
  parseGoogleReviews,
  reviewsLayout,
} from "@/lib/googleReviews";

const apiReview = (overrides: Record<string, unknown> = {}) => ({
  rating: 5,
  text: { text: "Translated words", languageCode: "en" },
  originalText: {
    text: "Very bespoke service by an extremely friendly group of guys",
    languageCode: "en",
  },
  relativePublishTimeDescription: "6 months ago",
  googleMapsUri: "https://www.google.com/maps/reviews/data=review1",
  authorAttribution: {
    displayName: "Jason Brown",
    uri: "https://www.google.com/maps/contrib/123/reviews",
    photoUri: "https://lh3.googleusercontent.com/a/photo",
  },
  ...overrides,
});

describe("parseGoogleReviews", () => {
  it("keeps the words as written, with the author's attribution", () => {
    const data = parseGoogleReviews({
      rating: 5,
      userRatingCount: 1,
      googleMapsUri: "https://maps.google.com/?cid=1",
      reviews: [apiReview()],
    });
    expect(data).toEqual({
      rating: null,
      reviewCount: 1,
      mapsUrl: "https://maps.google.com/?cid=1",
      reviews: [
        {
          rating: 5,
          text: "Very bespoke service by an extremely friendly group of guys",
          relativeTime: "6 months ago",
          authorName: "Jason Brown",
          authorUrl: "https://www.google.com/maps/contrib/123/reviews",
          authorPhotoUrl: "https://lh3.googleusercontent.com/a/photo",
          reviewUrl: "https://www.google.com/maps/reviews/data=review1",
        },
      ],
    });
  });

  it("shows the overall rating only once it rests on enough reviews", () => {
    expect(
      parseGoogleReviews({ rating: 5, userRatingCount: GOOGLE_RATING_MIN_REVIEWS - 1 }).rating,
    ).toBeNull();
    expect(
      parseGoogleReviews({ rating: 4.86, userRatingCount: GOOGLE_RATING_MIN_REVIEWS }).rating,
    ).toBe(4.9);
  });

  it("falls back to Google's text when there is no original", () => {
    const data = parseGoogleReviews({ reviews: [apiReview({ originalText: undefined })] });
    expect(data.reviews[0].text).toBe("Translated words");
  });

  it("drops reviews with no words, no author or an impossible rating, and never keeps more than five", () => {
    const data = parseGoogleReviews({
      reviews: [
        apiReview({ originalText: undefined, text: undefined }),
        apiReview({ authorAttribution: {} }),
        apiReview({ rating: 0 }),
        ...Array.from({ length: 7 }, () => apiReview()),
      ],
    });
    expect(data.reviews).toHaveLength(5);
  });

  it("lets only https links through to an href or src", () => {
    const data = parseGoogleReviews({
      googleMapsUri: "javascript:alert(1)",
      reviews: [
        apiReview({
          authorAttribution: { displayName: "A", uri: "http://x.test", photoUri: "data:x" },
        }),
      ],
    });
    expect(data.mapsUrl).toBeNull();
    expect(data.reviews[0]).toMatchObject({ authorUrl: null, authorPhotoUrl: null });
  });

  it("survives a response that isn't the shape it expects", () => {
    for (const body of [null, "nope", 42, { reviews: "x" }]) {
      expect(parseGoogleReviews(body)).toEqual({
        rating: null,
        reviewCount: 0,
        mapsUrl: null,
        reviews: [],
      });
    }
  });
});

describe("reviewsLayout", () => {
  it("features a lone review, and carousels two or more", () => {
    expect(reviewsLayout(0)).toBe("none");
    expect(reviewsLayout(1)).toBe("featured");
    for (const count of [2, 3, 4, 5]) expect(reviewsLayout(count)).toBe("carousel");
  });
});

describe("carouselLabel", () => {
  it("counts the cards in view", () => {
    expect(carouselLabel(0, 3, 5)).toBe("1–3 of 5");
    expect(carouselLabel(3, 3, 5)).toBe("4–5 of 5");
    expect(carouselLabel(1, 2, 5)).toBe("2–3 of 5");
  });

  it("names a single card on its own, as on a phone", () => {
    expect(carouselLabel(2, 1, 5)).toBe("3 of 5");
    expect(carouselLabel(4, 3, 5)).toBe("5 of 5");
  });

  it("stays in range whatever the scroll position says", () => {
    expect(carouselLabel(-1, 3, 5)).toBe("1–3 of 5");
    expect(carouselLabel(9, 3, 5)).toBe("5 of 5");
    expect(carouselLabel(0, 0, 5)).toBe("1 of 5");
  });
});
