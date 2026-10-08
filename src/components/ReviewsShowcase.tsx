"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import Stars from "@/components/Stars";
import TrustpilotBadge from "@/components/TrustpilotBadge";
import {
  carouselLabel,
  reviewsLayout,
  type GoogleReview,
  type GoogleReviewsData,
} from "@/lib/googleReviews";
import { GOOGLE_REVIEWS } from "@/lib/site";

/** Start asking this far before the section scrolls into view, so it's filled by the time it's seen. */
const PREFETCH_MARGIN = "600px";
/** Must match the track's gap-6. */
const CARD_GAP = 24;

const external = { target: "_blank", rel: "noopener noreferrer" } as const;
const newTab = <span className="sr-only"> (opens in a new tab)</span>;

/**
 * Google's own "Google Maps" attribution logo (the grey version, from its
 * attribution assets, for light backgrounds), 16–19px tall as Google requires.
 */
function GoogleMapsLogo({ height = 16 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/google-maps-logo.svg"
      alt="Google Maps"
      width={Math.round((height * 98) / 18)}
      height={height}
      className="block shrink-0"
      style={{ height }}
    />
  );
}

/** Google's attribution for the author: their photo (or initial), name and profile link. */
function Author({ review, large = false }: { review: GoogleReview; large?: boolean }) {
  const size = large ? 48 : 40;
  const name = <strong className="font-semibold text-ink">{review.authorName}</strong>;
  return (
    <div className="flex min-w-0 items-center gap-3">
      {review.authorPhotoUrl ? (
        // A plain <img>, not next/image: the optimiser would store a copy,
        // and Google's terms allow storing nothing but the place ID.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={review.authorPhotoUrl}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="shrink-0 rounded-full"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden
          className="flex shrink-0 items-center justify-center rounded-full bg-plum font-semibold text-white"
          style={{ width: size, height: size }}
        >
          {review.authorName.charAt(0).toUpperCase()}
        </span>
      )}
      <p className={`min-w-0 text-ink-3 ${large ? "text-base" : "text-[15px]"}`}>
        {review.authorUrl ? (
          <a href={review.authorUrl} {...external} className="hover:underline">
            {name}
            {newTab}
          </a>
        ) : (
          name
        )}
        <br />
        {/* The carousel card carries Google's logo beside the stars, so it needn't say it again. */}
        {large
          ? `${review.relativeTime ? `${review.relativeTime} · ` : ""}Google review`
          : review.relativeTime}
      </p>
    </div>
  );
}

function ReviewLink({ review, label }: { review: GoogleReview; label: string }) {
  const href = review.reviewUrl ?? review.authorUrl;
  if (!href) return null;
  return (
    <a href={href} {...external} className="link shrink-0 text-[15px] font-medium">
      {label}
      <span className="sr-only"> from {review.authorName} on Google (opens in a new tab)</span>
    </a>
  );
}

/** A review in the carousel: cut to five lines, with "Read more" opening it on Google. */
function ReviewCard({ review }: { review: GoogleReview }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-7 sm:p-9">
      <div className="flex items-center justify-between gap-4">
        <Stars label={`Rated ${review.rating} out of 5`} rating={review.rating} size={18} />
        <GoogleMapsLogo />
      </div>
      <blockquote className="mt-5">
        <p className="line-clamp-5 font-display text-xl leading-[1.45] text-ink">{review.text}</p>
      </blockquote>
      {/* Pushes the footer down so it lines up across cards of different lengths. */}
      <div className="min-h-6 flex-1" />
      <figcaption className="flex items-center justify-between gap-4 border-t border-line pt-6">
        <Author review={review} />
        <ReviewLink review={review} label="Read more" />
      </figcaption>
    </figure>
  );
}

/** The one review, when there is only one: given the room a lone card in a row would leave empty. */
function FeaturedReview({ review }: { review: GoogleReview }) {
  return (
    <figure className="relative flex flex-col rounded-2xl bg-surface p-8 shadow-cover sm:p-12">
      <span
        aria-hidden
        className="pointer-events-none absolute left-7 top-1 font-display text-[110px] leading-none text-mist-3 sm:left-11"
      >
        “
      </span>
      <div className="relative flex items-center justify-between gap-4 pt-6">
        <Stars label={`Rated ${review.rating} out of 5`} rating={review.rating} size={22} />
        <GoogleMapsLogo height={18} />
      </div>
      <blockquote className="relative mt-6">
        <p className="font-display text-[28px] leading-[1.3] text-ink sm:text-[36px]">
          {review.text}
        </p>
      </blockquote>
      <figcaption className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-7">
        <Author review={review} large />
        <ReviewLink review={review} label="Read on Google" />
      </figcaption>
    </figure>
  );
}

/** Google's credit and the link to the listing — required wherever its reviews show. */
function GoogleCredit({ mapsUrl }: { mapsUrl: string }) {
  return (
    <p className="text-[15px] text-ink-3">
      Reviews from Google Maps, in the order Google ranks them as most relevant.{" "}
      <a href={mapsUrl} {...external} className="link">
        See them all on Google Maps
        {newTab}
      </a>
    </p>
  );
}

/**
 * Cards in a scroll-snapped row: three in view on a wide screen, two on a
 * tablet, one on a phone. `aside` (Trustpilot's badge) shares the row with
 * the counter and arrows, which show only when there is more than fits.
 */
function ReviewCarousel({
  reviews,
  mapsUrl,
  aside,
}: {
  reviews: GoogleReview[];
  mapsUrl: string;
  aside: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ first: 0, perPage: reviews.length });

  const measure = useCallback(() => {
    const element = track.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (!element || !card || !card.offsetWidth) return;
    const step = card.offsetWidth + CARD_GAP;
    setView({
      first: Math.round(element.scrollLeft / step),
      perPage: Math.max(1, Math.round((element.clientWidth + CARD_GAP) / step)),
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const page = (direction: 1 | -1) => {
    const element = track.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (!element || !card) return;
    element.scrollBy({
      left: direction * view.perPage * (card.offsetWidth + CARD_GAP),
      behavior: "smooth",
    });
  };

  const paged = reviews.length > view.perPage;
  const atStart = view.first <= 0;
  const atEnd = view.first + view.perPage >= reviews.length;
  const arrow =
    "flex size-14 items-center justify-center rounded-full border-[1.5px] border-plum text-plum transition-colors hover:bg-mist disabled:cursor-default disabled:border-line-2 disabled:text-line-2 disabled:hover:bg-transparent";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Google reviews"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-2">{aside}</div>
        {paged && (
          <div className="flex items-center gap-4">
            <p aria-live="polite" className="text-[15px] text-ink-3">
              {carouselLabel(view.first, view.perPage, reviews.length)}
            </p>
            <button
              type="button"
              onClick={() => page(-1)}
              disabled={atStart}
              aria-label="Previous reviews"
              className={arrow}
            >
              <ArrowLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              disabled={atEnd}
              aria-label="Next reviews"
              className={arrow}
            >
              <ArrowRight size={20} aria-hidden />
            </button>
          </div>
        )}
      </div>
      <div
        ref={track}
        onScroll={measure}
        className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <div
            key={`${review.authorName}-${review.relativeTime}`}
            className="shrink-0 basis-[88%] snap-start md:basis-[calc((100%-24px)/2)] lg:basis-[calc((100%-48px)/3)]"
          >
            <ReviewCard review={review} />
          </div>
        ))}
      </div>
      <GoogleCredit mapsUrl={mapsUrl} />
    </section>
  );
}

/**
 * "From families we've helped" — Trustpilot's badge and the business's live
 * Google reviews (googleReviews.ts has the rules), up to five, nothing typed
 * by hand. One review is featured beside the heading; two or more go in a
 * carousel under it (reviewsLayout).
 *
 * The reviews are asked for only when the section nears the screen — each
 * ask is a paid Places call, and Google's terms forbid keeping a copy, so a
 * visitor who never scrolls here costs nothing. Until Google answers, or if
 * it doesn't, the heading and the links to both review sites show alone.
 */
export default function ReviewsShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [google, setGoogle] = useState<GoogleReviewsData | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        fetch("/api/google-reviews", { cache: "no-store" })
          .then((response) =>
            response.ok ? (response.json() as Promise<GoogleReviewsData>) : null,
          )
          .then((data) => {
            if (!cancelled && data) setGoogle(data);
          })
          .catch(() => undefined);
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const reviews = google?.reviews ?? [];
  const layout = reviewsLayout(reviews.length);
  const mapsUrl = google?.mapsUrl ?? GOOGLE_REVIEWS.profileUrl;

  const heading = <h2 className="type-section">From families we’ve helped</h2>;
  const rating = google?.rating != null && (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
      <Stars
        label={`Rated ${google.rating} out of 5 on Google`}
        rating={Math.round(google.rating)}
      />
      <span>
        <strong className="font-semibold text-ink">{google.rating.toFixed(1)}</strong> from{" "}
        {google.reviewCount} reviews on Google Maps
      </span>
    </p>
  );

  if (layout === "carousel") {
    return (
      <div ref={ref} data-layout="carousel" className="flex flex-col gap-5">
        {heading}
        <ReviewCarousel
          reviews={reviews}
          mapsUrl={mapsUrl}
          aside={
            <>
              <TrustpilotBadge />
              {rating}
            </>
          }
        />
      </div>
    );
  }

  // Featured, and also the shape before Google answers: this div is what the observer watches.
  return (
    <div
      ref={ref}
      data-layout={layout}
      className={
        layout === "featured"
          ? "grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16"
          : "max-w-[640px]"
      }
    >
      <div className="flex flex-col gap-6">
        {heading}
        <p className="max-w-[30em] text-ink-2">
          We’re a small team, and every order is handled with care. Here’s what people say about us.
        </p>
        <div className="flex flex-col gap-4 border-t border-line pt-7">
          <TrustpilotBadge />
          {rating}
          <a
            href={mapsUrl}
            {...external}
            className="flex min-h-11 items-center gap-2.5 self-start text-ink-2 hover:text-plum"
          >
            Read our reviews on <GoogleMapsLogo height={18} />
            {newTab}
          </a>
        </div>
      </div>
      {layout === "featured" && <FeaturedReview review={reviews[0]} />}
    </div>
  );
}
