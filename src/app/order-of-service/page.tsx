import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronRight, Clock, Heart, Palette } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import OrderOfServiceConfigurator from "@/components/OrderOfServiceConfigurator";
import {
  defaultSelection,
  formatPence,
  getQuote,
} from "@/lib/orderOfServicePricing";
import { getPricingData } from "@/lib/pricing.server";

// Pricing lives in MySQL and is editable from /admin, so this page must
// render per-request rather than being frozen at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order of Service Booklets | The Funeral Stationery",
  description:
    "Personalised order of service booklets from 15 copies. Choose your size, page count, colour and paper, see the price instantly, and have them delivered next day.",
};

const PREVIEW_IMAGE =
  "https://lh3.googleusercontent.com/aida/AEtjO1UZ-qKw2zOQhr6QfvfFb6-r7WRdHlE5U6j6qJ4Jxt5AXS6AttERQGRnTr-bQ31v31ImAw5oTaLC7K1q50_udIDPuwWb447CYNK9zlP7V_wVKYQ5AGIvyLv-zU8qO0IMYTggeWp-DjGBVk_FCW-Bdr-c_7QPoDeXB_L4DRQ_JrtH6vGb4PZ2iVqU5XghErR0rG9B4IsvrIiLvwOtZc9VoEkpyMQ6BttDshSqfHGFKCVdbTPGBuyZVYDiJluA";

const THEMES = [
  "Floral",
  "Classic",
  "Religious",
  "Nature",
  "Sport",
  "Children",
  "Music",
];

const INCLUDED = [
  {
    icon: Palette,
    title: "Your design, or ours",
    description:
      "Start from one of our themes, or upload the Canva design you have already made. We will match it exactly.",
  },
  {
    icon: Heart,
    title: "A proof before we print",
    description:
      "You will see a digital proof and can ask for changes. Nothing goes to press until you are happy with it.",
  },
  {
    icon: Clock,
    title: "24hrs to 72hrs turnaround",
    description:
      "Approved before 11am with next day delivery selected and your booklets are with you the next working day.",
  },
];

const SPECS = [
  ["Sizes", "A5 (148 x 210mm)"],
  ["Page counts", "4, 8, 12, 16, 20 and 24 page booklets"],
  ["Paper", "150gsm silk, gloss or uncoated, or 200gsm premium silk"],
  ["Binding", "Folded to 8 pages, saddle stitched from 12 pages"],
  ["Printing", "Full colour both sides, colour cover with mono inside, or black & white"],
  ["Minimum order", "15 copies"],
];

export default async function OrderOfServicePage() {
  const pricing = await getPricingData("order-of-service");
  // The cheapest configuration: first option on every axis, mono colour.
  const startingQuote = getQuote(pricing, {
    ...defaultSelection(pricing),
    colour: "mono",
  });

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="px-margin-mobile md:px-gutter pt-8 pb-section-gap md:pt-10 bg-surface">
          <div className="max-w-[1200px] mx-auto">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 font-body text-sm text-on-surface-variant mb-4"
            >
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <ChevronRight size={14} aria-hidden />
              <span className="text-on-surface">Order of Service</span>
            </nav>

            <h1 className="font-display text-3xl md:text-4xl font-semibold text-primary leading-tight mb-2">
              Order of Service Booklets
            </h1>
            <p className="font-body text-lg text-on-surface-variant mb-6">
              From{" "}
              <span className="font-semibold text-secondary">
                {formatPence(startingQuote.totalPence)}
              </span>{" "}
              for 15 copies
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-6 items-start">
              <div className="order-2 lg:order-1 lg:sticky lg:top-28">
                <div className="relative w-full aspect-4/3 rounded-xl bg-surface-container-low ambient-shadow overflow-hidden">
                  <Image
                    src={PREVIEW_IMAGE}
                    alt="An example order of service booklet"
                    fill
                    priority
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-contain p-6"
                  />
                </div>

                <p className="font-body text-sm uppercase tracking-[0.18em] text-secondary mt-8 mb-4">
                  Available themes
                </p>
                <div className="flex flex-wrap gap-3">
                  {THEMES.map((theme) => (
                    <Link
                      key={theme}
                      href="/#templates"
                      className="rounded-full bg-soft-sage px-5 py-2 font-body text-sm font-medium tracking-wide text-secondary transition-colors hover:bg-secondary-container"
                    >
                      {theme}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="order-1 lg:order-2 lg:-mt-[69px]">
                <OrderOfServiceConfigurator pricing={pricing} />
              </div>
            </div>
          </div>
        </section>

        <section className="px-margin-mobile md:px-gutter py-section-gap bg-surface-container-low">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-4 text-center">
              What Every Order Includes
            </h2>
            <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto text-center mb-16">
              The price you see covers everything from your first draft to the
              box arriving at your door.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {INCLUDED.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-soft-sage bg-surface-container-lowest p-8 ambient-shadow"
                >
                  <item.icon className="text-primary mb-5" size={32} aria-hidden />
                  <h3 className="font-display text-xl text-on-surface mb-3">
                    {item.title}
                  </h3>
                  <p className="font-body text-on-surface-variant">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-16 rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-8 md:p-10">
              <h3 className="font-display text-2xl text-primary mb-8">
                Specification
              </h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
                {SPECS.map(([term, detail]) => (
                  <div key={term} className="flex items-start gap-4">
                    <Check
                      size={20}
                      aria-hidden
                      className="text-secondary shrink-0 mt-1"
                    />
                    <div>
                      <dt className="font-body font-medium text-on-surface">
                        {term}
                      </dt>
                      <dd className="font-body text-on-surface-variant">
                        {detail}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
