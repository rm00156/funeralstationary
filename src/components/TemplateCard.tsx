import Image from "next/image";
import Link from "next/link";

import { A5_TRIM, coverWidthFactor, trimAspect, type PageTrim } from "@/lib/designEditor";

/**
 * One design in a grid: its cover on a tinted panel, name and a meta line.
 * The whole card is a single link to the design's own page.
 */
export default function TemplateCard({
  href,
  name,
  image,
  meta,
  priority = false,
  trim = A5_TRIM,
}: {
  href: string;
  name: string;
  image: string;
  meta: string;
  priority?: boolean;
  /** The product's trim, so a bookmark's cover is bookmark-shaped. */
  trim?: PageTrim;
}) {
  const narrow = coverWidthFactor(trim);
  return (
    <Link href={href} className="card-link group flex flex-col gap-4 no-underline">
      <div className="flex justify-center rounded-xl bg-mist-3 p-7">
        <div
          className="cover relative overflow-hidden rounded-[3px] bg-sheet"
          style={{ aspectRatio: trimAspect(trim), width: `${narrow * 100}%`, maxWidth: 190 * narrow }}
        >
          <Image
            src={image}
            alt={`${name} design, front cover`}
            fill
            priority={priority}
            sizes={`${Math.round(190 * narrow)}px`}
            className="object-cover"
          />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="font-display text-[21px] font-medium text-ink underline-offset-4 group-hover:underline">
          {name}
        </h3>
        <p className="text-[15px] text-ink-3">{meta}</p>
      </div>
    </Link>
  );
}
