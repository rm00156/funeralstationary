import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import Stars from "@/components/Stars";
import { PAGE_H_MM, PAGE_SIZE_LABEL, PAGE_W_MM } from "@/lib/designEditor";
import { formatPence } from "@/lib/orderOfServicePricing";
import { ORDER_CUTOFF, TRUSTPILOT, UPLOAD_DESIGN_HREF } from "@/lib/site";
import type { ProductShowcase, Template } from "@/lib/templates";

/**
 * The home page hero. It leads with the shop's first product (sort order is
 * the admin's call) — its name, design count, "from" price and two of its real
 * covers — so nothing here is a hardcoded claim about the catalogue.
 */
export default function Hero({
  lead,
  covers,
}: {
  lead: ProductShowcase | null;
  /** Up to two of the lead product's designs, shown as overlapping covers. */
  covers: Template[];
}) {
  const [front, back] = covers;

  return (
    <section className="bg-paper">
      <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-center gap-16 pb-20 pt-14 md:pb-24 md:pt-[88px]">
        <div className="flex flex-col gap-7">
          {lead && (
            <p className="text-[15px] font-semibold uppercase tracking-[0.14em] text-plum">
              {lead.label}
            </p>
          )}
          <h1 className="type-hero">
            A beautiful order of service,{" "}
            <em className="text-plum">ready in time for the day.</em>
          </h1>
          <p className="max-w-[34em] text-xl leading-[1.6] text-ink-2">
            {lead
              ? `Choose one of ${lead.templateCount} designs, add their photographs and words online, and we’ll print on heavyweight ${PAGE_SIZE_LABEL} paper and deliver anywhere in the UK.`
              : "Choose a design, add their photographs and words online, and we’ll print on heavyweight paper and deliver anywhere in the UK."}
          </p>
          <ul className="flex flex-col gap-3 text-[17px]">
            {[
              `Order by ${ORDER_CUTOFF} for next-working-day delivery`,
              lead && `From ${formatPence(lead.fromPence)} for ${lead.fromCopies} copies`,
              "Made something in Canva? Send it to us and we’ll print it",
            ]
              .filter((item): item is string => !!item)
              .map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check size={22} aria-hidden className="shrink-0 text-plum" />
                  {item}
                </li>
              ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-1">
            <a href="#designs" className="btn btn-primary min-h-14 px-[30px] text-lg">
              Browse designs
              <ArrowRight size={18} aria-hidden />
            </a>
            <Link href={UPLOAD_DESIGN_HREF} className="link text-[17px] font-medium">
              Upload your own design
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5 border-t border-line pt-6 text-[15px] text-ink-2">
            <Stars label={`Rated ${TRUSTPILOT.rating} out of 5`} />
            <span>
              <strong className="font-semibold text-ink">{TRUSTPILOT.rating} out of 5</strong> from{" "}
              {TRUSTPILOT.reviewCount} reviews on Trustpilot
            </span>
          </div>
        </div>

        {front && (
          <div className="relative flex items-end justify-center pb-10 pt-6">
            <div
              aria-hidden
              className="absolute inset-x-[6%] bottom-0 top-[8%] rounded-b-3xl rounded-t-[280px] bg-mist-3"
            />
            <div className="relative z-[1] aspect-[148/210] w-[min(270px,52%)] rotate-[-4deg] overflow-hidden rounded-[3px] bg-sheet shadow-cover-lg">
              <Image
                src={front.image}
                alt={`${front.name} design, front cover`}
                fill
                priority
                sizes="270px"
                className="object-cover"
              />
            </div>
            {back && (
              <div className="relative z-[2] -mb-5 -ml-[70px] aspect-[148/210] w-[min(240px,46%)] rotate-[5deg] overflow-hidden rounded-[3px] bg-sheet shadow-cover-lg">
                <Image
                  src={back.image}
                  alt={`${back.name} design, front cover`}
                  fill
                  priority
                  sizes="240px"
                  className="object-cover"
                />
              </div>
            )}
            <p className="absolute bottom-0 right-[4%] z-[3] rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-2 shadow-cover">
              {PAGE_SIZE_LABEL} · {PAGE_W_MM} × {PAGE_H_MM} mm · heavyweight paper
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
