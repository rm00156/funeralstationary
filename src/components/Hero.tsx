import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import TrustpilotBadge from "@/components/TrustpilotBadge";
import { coverWidthFactor, trimAspect } from "@/lib/designEditor";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import { ORDER_CUTOFF, UPLOAD_DESIGN_HREF } from "@/lib/site";
import type { ProductShowcase, Template } from "@/lib/templates";

/**
 * The home page hero. It leads with the shop's first product (sort order is
 * the admin's call) — its name, design count, "from" price and four of its real
 * covers — so nothing here is a hardcoded claim about the catalogue.
 */
export default function Hero({
  lead,
  covers,
}: {
  lead: ProductShowcase | null;
  /**
   * Up to four of the lead product's designs: flat covers in two columns
   * beside the text, or a small row under the headline below lg.
   */
  covers: Template[];
}) {
  const trim = lead?.format.trim;
  const aspectRatio = trim ? trimAspect(trim) : undefined;
  const narrow = trim ? coverWidthFactor(trim) : 1;

  return (
    <section className="bg-paper">
      {/* One column below lg: the covers move from beside the text to a
          small row inside it (see below), so the switch is one breakpoint. */}
      <div className="site-container grid items-center gap-16 pb-20 pt-10 md:pb-24 md:pt-14 lg:grid-cols-2">
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
          {/* On a phone the covers beside the text would land a screen below
              the button, just above the design grid. A small row here puts
              the product on the first screen instead. */}
          {lead && covers.length > 0 && (
            <div className="flex w-full max-w-[360px] items-start gap-2.5 lg:hidden">
              {covers.map((cover) => (
                <div
                  key={cover.id}
                  className="relative shrink-0 overflow-hidden rounded-[2px] bg-sheet shadow-cover"
                  // A quarter of the row less its three 10px gaps; a narrow
                  // format (a bookmark) narrower, at the same height.
                  style={{ aspectRatio, width: `calc((100% - 30px) / 4 * ${narrow})` }}
                >
                  <Image
                    src={cover.image}
                    alt={`${cover.name} design, front cover`}
                    fill
                    loading="eager"
                    sizes="90px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
          <p className="max-w-[34em] text-xl leading-[1.6] text-ink-2">
            {lead
              ? `Choose one of ${lead.templateCount} designs, add their photographs and words online, and we’ll print and deliver anywhere in the UK.`
              : "Choose a design, add their photographs and words online, and we’ll print on heavyweight paper and deliver anywhere in the UK."}
          </p>
          <ul className="flex flex-col gap-3 text-[17px]">
            {[
              `Order by ${ORDER_CUTOFF} for next-working-day delivery`,
              lead && `From ${formatPence(lead.fromPence)} for ${copiesText(lead.fromCopies)}`,
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
          <div className="mt-1 border-t border-line pt-6 text-[15px]">
            <TrustpilotBadge />
          </div>
        </div>

        {lead && covers.length > 0 && (
          <div className="hidden flex-col items-center gap-6 lg:flex">
            {/* Two columns, the second dropped a little — flat covers laid
                out like a shop's product shots, not a fan of tilted prints. */}
            <div className="grid grid-cols-2 items-start gap-x-[clamp(20px,4vw,44px)]">
              {[0, 1].map((column) => (
                <div key={column} className={`flex flex-col gap-6 ${column === 1 ? "mt-10" : ""}`}>
                  {covers
                    .filter((_, index) => index % 2 === column)
                    .map((cover) => (
                      <div
                        key={cover.id}
                        className="relative overflow-hidden rounded-[3px] bg-sheet shadow-cover"
                        style={{ aspectRatio, width: `calc(190px * ${narrow})` }}
                      >
                        <Image
                          src={cover.image}
                          alt={`${cover.name} design, front cover`}
                          fill
                          priority
                          sizes="190px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                </div>
              ))}
            </div>
            <p className="text-[15px] text-ink-2">
              {lead.templateCount} designs · {lead.format.sizeLabel} heavyweight paper
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
