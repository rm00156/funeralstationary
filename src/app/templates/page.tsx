import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import TemplateBrowser from "@/components/TemplateBrowser";

export const metadata: Metadata = {
  title: "Funeral Stationery Templates | The Funeral Stationery",
  description:
    "Browse our funeral order of service templates and personalise the wording, photographs, colours and pages. Design it yourself, or send us your content and we will put every page together for you.",
};

export default function TemplatesPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="px-margin-mobile md:px-gutter pt-8 pb-section-gap bg-surface">
          <div className="max-w-[1200px] mx-auto">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 font-body text-sm text-on-surface-variant mb-10"
            >
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <ChevronRight size={14} aria-hidden />
              <span className="text-on-surface">Templates</span>
            </nav>

            <div className="text-center flex flex-col items-center">
              <h1 className="font-display text-4xl md:text-5xl font-semibold text-primary max-w-4xl leading-tight mb-8">
                Funeral Order of Service Templates
              </h1>

              <p className="font-body text-lg md:text-xl text-on-surface-variant max-w-3xl mb-10">
                Choose a template and personalise the wording, photographs,
                colours and pages. When your design is ready, we print and
                deliver it anywhere in the UK. Do it yourself, or send us your
                content and we will put every page together for you.
              </p>

              <p className="inline-flex items-center gap-3 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-6 py-3 font-body text-sm text-on-surface-variant ambient-shadow">
                <span className="flex items-center gap-0.5 text-secondary">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      size={14}
                      aria-hidden
                      className="fill-secondary"
                    />
                  ))}
                </span>
                <span>
                  <span className="font-semibold text-on-surface">
                    Rated 4.9
                  </span>{" "}
                  from 164 verified customer reviews
                </span>
              </p>
            </div>

            <div className="mt-12 md:mt-16">
              <TemplateBrowser />
            </div>
          </div>
        </section>

        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
