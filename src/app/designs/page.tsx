import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SavedDesignList from "@/components/SavedDesignList";
import { listDesigns } from "@/lib/designs.server";
import { readOwner } from "@/lib/session";
import { PRODUCTS, TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = {
  title: "My Designs | The Funeral Stationery",
  description: "Open, rename or remove the funeral stationery designs you have saved.",
  robots: { index: false, follow: false },
};

export default async function DesignsPage() {
  const owner = await readOwner();
  const saved = owner ? await listDesigns(owner) : [];

  const designs = saved.map((design) => ({
    id: design.id,
    name: design.name,
    pageCount: design.pageCount,
    updatedAt: design.updatedAt.toISOString(),
    templateName:
      TEMPLATES.find((template) => template.id === design.templateId)?.name ??
      design.templateId,
    productLabel:
      PRODUCTS.find((product) => product.id === design.productId)?.label ??
      design.productId,
  }));

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
              <span className="text-on-surface">My Designs</span>
            </nav>

            <h1 className="font-display text-4xl md:text-5xl font-semibold text-primary leading-tight mb-6">
              My Designs
            </h1>
            <p className="font-body text-lg text-on-surface-variant max-w-3xl mb-10">
              Every design you start is saved automatically as you go. Pick up
              where you left off, or begin a new one from any of our templates.
            </p>

            <SavedDesignList initialDesigns={designs} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
