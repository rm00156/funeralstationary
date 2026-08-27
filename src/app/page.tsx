import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustStrip from "@/components/TrustStrip";
import ProductRange from "@/components/ProductRange";
import HowItWorks from "@/components/HowItWorks";
import PricingDelivery from "@/components/PricingDelivery";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import { getCategoryShowcase, getProducts } from "@/lib/catalogue.server";

// The category tiles and product pills come from the catalogue in MySQL,
// which is editable from /admin — render per-request rather than freezing
// the grid at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, products] = await Promise.all([
    getCategoryShowcase(),
    getProducts(),
  ]);

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <ProductRange categories={categories} products={products} />
        <HowItWorks />
        <PricingDelivery />
        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
