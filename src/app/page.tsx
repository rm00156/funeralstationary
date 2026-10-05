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

// The products and designs come from the catalogue in MySQL, which is editable
// from /admin — render per-request rather than freezing them at build time.
export const dynamic = "force-dynamic";

/** How many of the lead product's designs the home page shows. */
const HOME_DESIGN_COUNT = 4;

export default async function Home() {
  const [products, templates] = await Promise.all([getSellableProducts(), getTemplates()]);

  // The page leads with the first sellable product (sort order is set in
  // /admin); the rest of the range follows further down.
  const [lead, ...rest] = products;
  const leadTemplates = lead
    ? templates.filter((template) => template.productId === lead.id)
    : [];
  const leadPricing = lead ? await getPricingData(lead.id) : null;

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <Hero lead={lead ?? null} covers={leadTemplates.slice(0, 2)} />
        {lead && (
          <HomeDesigns product={lead} templates={leadTemplates.slice(0, HOME_DESIGN_COUNT)} />
        )}
        <ProductRange products={rest} />
        <QualityDelivery delivery={leadPricing?.delivery ?? []} format={lead?.format ?? null} />
        <Testimonials />
        <HelpBand />
      </main>
      <Footer />
    </>
  );
}
