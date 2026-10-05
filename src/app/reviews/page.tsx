import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import HelpBand from "@/components/HelpBand";
import ReviewCard from "@/components/ReviewCard";
import Stars from "@/components/Stars";
import {
  FEATURED_REVIEWS,
  GOOGLE_REVIEWS,
  PHONE_DISPLAY,
  PHONE_HREF,
  TRUSTPILOT,
} from "@/lib/site";

// The header and footer read the live catalogue (and the signed-in customer).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews | The Funeral Stationery",
  description: `Rated ${TRUSTPILOT.rating} out of 5 from ${TRUSTPILOT.reviewCount} reviews on Trustpilot. Read what families say about our Order of Service booklets and funeral stationery.`,
};

export default function ReviewsPage() {
  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <section className="bg-paper">
          <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-end gap-12 pb-[72px] pt-10 md:pt-14">
            <div className="flex flex-col gap-5">
              <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Reviews" }]} />
              <h1 className="type-page">What families say about us</h1>
              <p className="max-w-[34em] text-xl text-ink-2">
                Every review is from a verified customer on Trustpilot. We read each one, and
                we’re grateful to everyone who takes the time.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line bg-surface px-7 py-9 sm:px-10">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-display text-[72px] leading-none text-ink">
                    {TRUSTPILOT.rating}
                  </span>
                  <span className="text-ink-2">out of 5</span>
                </div>
                <Stars label={`Rated ${TRUSTPILOT.rating} out of 5`} size={24} />
                <p className="text-base text-ink-2">
                  Based on {TRUSTPILOT.reviewCount} reviews on Trustpilot
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <a
                  href={TRUSTPILOT.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary px-6 text-base"
                >
                  Read all on Trustpilot
                  <ArrowUpRight size={16} aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                <a
                  href={GOOGLE_REVIEWS.writeReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link flex min-h-11 items-center justify-center text-center text-base font-medium"
                >
                  Ordered with us? Leave a review on Google
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="site-container flex flex-col gap-10 py-20">
            <h2 className="type-sub">Featured reviews</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-8">
              {FEATURED_REVIEWS.map((review) => (
                <ReviewCard key={review.name} review={review} featured />
              ))}
            </div>
          </div>
        </section>

        {/* The handoff asks for the official Trustpilot widget here, and for
            reviews never to be copied in by hand. The widget needs the
            business's own embed code, which we don't have yet — until it is
            dropped in, this section sends people to the live profile rather
            than showing a placeholder or reviews we typed ourselves. */}
        <section className="bg-paper">
          <div className="site-container flex flex-col gap-8 py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="type-sub">All reviews</h2>
              <p className="text-base text-ink-3">Newest first, straight from Trustpilot</p>
            </div>
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-surface px-7 py-14 text-center">
              <Stars label={`Rated ${TRUSTPILOT.rating} out of 5`} size={28} />
              <p className="max-w-[30em] font-display text-2xl leading-[1.3] text-ink">
                All {TRUSTPILOT.reviewCount} reviews are published, unedited, on our Trustpilot
                page.
              </p>
              <a
                href={TRUSTPILOT.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline px-6 text-base"
              >
                Read every review on Trustpilot
                <ArrowUpRight size={16} aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>
        </section>

        <HelpBand
          title="Ready when you are"
          body="Browse our designs, or call us and we’ll help you choose."
        >
          <Link href="/shop" className="btn btn-on-dark min-h-14 text-lg">
            Browse designs
          </Link>
          <a href={PHONE_HREF} className="btn btn-on-dark-outline min-h-14 text-lg">
            {PHONE_DISPLAY}
          </a>
        </HelpBand>
      </main>
      <Footer />
    </>
  );
}
