import { Star } from "lucide-react";

/** Five Trustpilot-green stars. The rating is spoken once, via the label. */
export default function Stars({ label, size = 18 }: { label: string; size?: number }) {
  return (
    <div role="img" aria-label={label} className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={size} aria-hidden className="fill-star text-star" />
      ))}
    </div>
  );
}
