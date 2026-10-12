import Image from "next/image";
import Link from "next/link";

import { A5_TRIM, coverWidthFactor, trimAspect, type PageTrim } from "@/lib/designEditor";

/** The widest an A5 cover is drawn, by card size (narrower formats scale down). */
const COVER_MAX_WIDTH = { default: 190, large: 240 } as const;

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
  size = "default",
}: {
  href: string;
  name: string;
  image: string;
  meta: string;
  priority?: boolean;
  /** The product's trim, so a bookmark's cover is bookmark-shaped. */
  trim?: PageTrim;
  /**
   * "large" for a grid of a few wide cards (the home page's three across): a
   * bigger cover, and a slimmer panel on a phone, where it sits two across.
   */
  size?: keyof typeof COVER_MAX_WIDTH;
}) {
  const narrow = coverWidthFactor(trim);
  const maxWidth = COVER_MAX_WIDTH[size] * narrow;
  return (
    <Link href={href} className="card-link group flex flex-col gap-4 no-underline">
      <div
        className={`flex justify-center rounded-xl bg-mist-3 ${size === "large" ? "p-4 sm:p-7" : "p-7"}`}
      >
        <div
          className="cover relative overflow-hidden rounded-[3px] bg-sheet"
          style={{ aspectRatio: trimAspect(trim), width: `${narrow * 100}%`, maxWidth }}
        >
          <Image
            src={image}
            alt={`${name} design, front cover`}
            fill
            priority={priority}
            sizes={`${Math.round(maxWidth)}px`}
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
