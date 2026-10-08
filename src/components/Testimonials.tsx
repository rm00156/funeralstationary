import ReviewsShowcase from "@/components/ReviewsShowcase";

/**
 * The home page's reviews section; ReviewsShowcase lays out Trustpilot's
 * badge and the business's live Google reviews. No
 * typed TrustScore or stars — Trustpilot's brand guidelines let a free
 * account show its score only through Trustpilot's own widgets.
 * It is the site's only reviews section (there is no /reviews page; that URL
 * redirects here), so it carries the `reviews` anchor.
 */
export default function Testimonials() {
  return (
    <section id="reviews" className="scroll-mt-6 bg-paper">
      <div className="site-container py-20 md:py-24">
        <ReviewsShowcase />
      </div>
    </section>
  );
}
