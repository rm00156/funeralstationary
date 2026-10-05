import Stars from "@/components/Stars";

export interface Review {
  title: string;
  body: string;
  initials: string;
  name: string;
  detail: string;
}

/**
 * One customer review. `featured` is the reviews page's larger card with the
 * reviewer's initials; the default is the home page's.
 */
export default function ReviewCard({
  review,
  featured = false,
}: {
  review: Review;
  featured?: boolean;
}) {
  return (
    <figure
      className={
        featured
          ? "flex flex-col gap-6 rounded-2xl bg-paper p-8 sm:p-12"
          : "flex flex-col gap-5 rounded-xl border border-line bg-surface p-7 sm:p-9"
      }
    >
      <Stars label="5 out of 5" size={featured ? 20 : 18} />
      <blockquote className={`flex flex-col ${featured ? "gap-4" : "gap-3"}`}>
        <p
          className={`font-display text-ink ${
            featured ? "text-[30px] leading-[1.25]" : "text-2xl leading-[1.3]"
          }`}
        >
          “{review.title}”
        </p>
        <p className="text-ink-2">{review.body}</p>
      </blockquote>
      {featured ? (
        <figcaption className="flex items-center gap-3.5 text-base text-ink-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-[15px] font-semibold text-white"
          >
            {review.initials}
          </span>
          <span>
            <strong className="font-semibold text-ink">{review.name}</strong>
            <br />
            {review.detail}
          </span>
        </figcaption>
      ) : (
        <figcaption className="text-[15px] text-ink-3">
          <strong className="font-semibold text-ink">{review.name}</strong> · Verified buyer
        </figcaption>
      )}
    </figure>
  );
}
