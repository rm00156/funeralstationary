import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HomeDesigns from "@/components/HomeDesigns";
import ProductRange from "@/components/ProductRange";
import QualityDelivery from "@/components/QualityDelivery";
import Testimonials from "@/components/Testimonials";
import HelpBand from "@/components/HelpBand";
import Footer from "@/components/Footer";
import { getSellableProducts, getTemplates } from "@/lib/catalogue.server";
import { getPricingData } from "@/lib/pricing.server";
import { homeDesignPicks } from "@/lib/templates";

// The products and designs come from the catalogue in MySQL, which is editable
// from /admin — render per-request rather than freezing them at build time.
export const dynamic = "force-dynamic";

/** How many of the lead product's designs the home page's grid shows — two rows of three. */
const HOME_DESIGN_COUNT = 6;

/** How many of them the hero pictures, which the grid then avoids repeating. */
const HERO_COVER_COUNT = 4;

/**
 * The template category the grid shows first — the plainer designs, which make
 * the best first look. Which designs those are is the admin's call (/admin).
 */
const HOME_DESIGN_CATEGORY = "simple";

export default async function Home() {
  const [products, templates] = await Promise.all([getSellableProducts(), getTemplates()]);

  // The page leads with the first sellable product (sort order is set in
  // /admin); the rest of the range follows further down.
  const [lead, ...rest] = products;
  const leadTemplates = lead
    ? templates.filter((template) => template.productId === lead.id)
    : [];
  const leadPricing = lead ? await getPricingData(lead.id) : null;
  const heroCovers = leadTemplates.slice(0, HERO_COVER_COUNT);

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <Hero lead={lead ?? null} covers={heroCovers} />
        {lead && (
          <HomeDesigns
            product={lead}
            templates={homeDesignPicks(leadTemplates, {
              categoryId: HOME_DESIGN_CATEGORY,
              heroIds: heroCovers.map((template) => template.id),
              count: HOME_DESIGN_COUNT,
            })}
          />
        )}
        <ProductRange products={rest} />
        <QualityDelivery
          delivery={leadPricing?.delivery ?? []}
          format={lead?.format ?? null}
          sizes={leadPricing?.size}
        />
        <Testimonials />
        <HelpBand />
      </main>
      <Footer />
    </>
  );
}
