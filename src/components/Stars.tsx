import { Star } from "lucide-react";

/** Five stars, filled up to a whole-star `rating`. The rating is spoken once, via the label. */
export default function Stars({
  label,
  rating = 5,
  size = 18,
}: {
  label: string;
  rating?: number;
  size?: number;
}) {
  return (
    <div role="img" aria-label={label} className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={size}
          aria-hidden
          className={index < rating ? "fill-star text-star" : "text-line-2"}
        />
      ))}
    </div>
  );
}
