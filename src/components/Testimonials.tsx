import Link from "next/link";

import ReviewCard from "@/components/ReviewCard";
import Stars from "@/components/Stars";
import { FEATURED_REVIEWS, TRUSTPILOT } from "@/lib/site";

/** The home page's reviews: the Trustpilot summary beside two real reviews. */
export default function Testimonials() {
  return (
    <section className="bg-paper">
      <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start gap-10 py-20 md:py-24">
        <div className="flex flex-col gap-4">
          <h2 className="type-section">From families we’ve helped</h2>
          <div className="flex items-baseline gap-3 pt-2">
            <span className="font-display text-[64px] leading-none text-ink">
              {TRUSTPILOT.rating}
            </span>
            <span className="text-ink-2">out of 5</span>
          </div>
          <Stars label={`Rated ${TRUSTPILOT.rating} out of 5`} size={22} />
          <p className="text-ink-2">Based on {TRUSTPILOT.reviewCount} reviews on Trustpilot</p>
          <Link href="/reviews" className="link flex min-h-11 items-center font-medium">
            Read all reviews
          </Link>
        </div>
        {FEATURED_REVIEWS.map((review) => (
          <ReviewCard key={review.name} review={review} />
        ))}
      </div>
    </section>
  );
}
