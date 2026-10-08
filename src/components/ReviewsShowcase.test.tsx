import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReviewsShowcase from "@/components/ReviewsShowcase";
import type { GoogleReview, GoogleReviewsData } from "@/lib/googleReviews";
import { GOOGLE_REVIEWS } from "@/lib/site";

const jason: GoogleReview = {
  rating: 5,
  text: "Very bespoke service",
  relativeTime: "6 months ago",
  authorName: "Jason Brown",
  authorUrl: "https://www.google.com/maps/contrib/1",
  authorPhotoUrl: "https://lh3.googleusercontent.com/a/photo",
  reviewUrl: "https://www.google.com/maps/reviews/1",
};

const google = (overrides: Partial<GoogleReviewsData> = {}): GoogleReviewsData => ({
  rating: null,
  reviewCount: 1,
  mapsUrl: "https://maps.google.com/?cid=1",
  reviews: [jason],
  ...overrides,
});

/** A controllable IntersectionObserver: `scrollNear()` reports the section as near the screen. */
let observerCallback: IntersectionObserverCallback | null = null;
const scrollNear = () =>
  act(async () => {
    observerCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await Promise.resolve();
  });

beforeEach(() => {
  observerCallback = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function answer(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status === 200, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const layout = (container: HTMLElement) =>
  container.querySelector("[data-layout]")?.getAttribute("data-layout");

describe("ReviewsShowcase", () => {
  it("shows the heading and a way to the listing, and doesn't ask Google until the section is near", () => {
    const fetchMock = answer(200, google());
    render(<ReviewsShowcase />);
    expect(screen.getByRole("heading", { name: "From families we’ve helped" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read our reviews on Google Maps/ })).toHaveAttribute(
      "href",
      GOOGLE_REVIEWS.profileUrl,
    );
    expect(screen.queryByText("Very bespoke service")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("features a lone review, with Google's logo, the author's attribution and a link to the review", async () => {
    const fetchMock = answer(200, google());
    const { container } = render(<ReviewsShowcase />);
    await scrollNear();

    expect(fetchMock).toHaveBeenCalledWith("/api/google-reviews", { cache: "no-store" });
    expect(layout(container)).toBe("featured");
    expect(screen.getByText("Very bespoke service")).toBeInTheDocument();
    expect(screen.getAllByAltText("Google Maps").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /^Jason Brown/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/contrib/1",
    );
    expect(screen.getByRole("link", { name: /Read on Google/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/reviews/1",
    );
    // The listing link now uses the address Google gave.
    expect(screen.getByRole("link", { name: /Read our reviews on Google Maps/ })).toHaveAttribute(
      "href",
      "https://maps.google.com/?cid=1",
    );
    // Below ten reviews there is no headline rating.
    expect(screen.queryByText(/reviews on Google Maps$/)).not.toBeInTheDocument();
  });

  it("puts several reviews in a carousel, each opening on Google, with Google credited", async () => {
    const reviews = ["A", "B", "C"].map((name, index) => ({
      ...jason,
      authorName: name,
      text: `Review ${name}`,
      reviewUrl: `https://www.google.com/maps/reviews/${index}`,
    }));
    answer(200, google({ reviewCount: 3, reviews }));
    const { container } = render(<ReviewsShowcase />);
    await scrollNear();

    expect(layout(container)).toBe("carousel");
    expect(screen.getByText("Review A")).toBeInTheDocument();
    expect(screen.getByText("Review C")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Read more/ }).map((a) => a.getAttribute("href")),
    ).toEqual([
      "https://www.google.com/maps/reviews/0",
      "https://www.google.com/maps/reviews/1",
      "https://www.google.com/maps/reviews/2",
    ]);
    expect(screen.getByRole("link", { name: /See them all on Google Maps/ })).toHaveAttribute(
      "href",
      "https://maps.google.com/?cid=1",
    );
  });

  it("shows the overall rating once Google gives one", async () => {
    answer(200, google({ rating: 4.9, reviewCount: 12 }));
    render(<ReviewsShowcase />);
    await scrollNear();
    expect(screen.getByText("4.9")).toBeInTheDocument();
    expect(screen.getByText(/from 12 reviews on Google Maps/)).toBeInTheDocument();
  });

  it("shows no reviews when Google doesn't answer, but keeps the heading and links", async () => {
    answer(503, { error: "Google reviews unavailable" });
    const { container } = render(<ReviewsShowcase />);
    await scrollNear();
    expect(layout(container)).toBe("none");
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Read our reviews on Google Maps/ }),
    ).toBeInTheDocument();
  });
});
