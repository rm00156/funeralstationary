import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustStrip from "@/components/TrustStrip";
import ProductRange from "@/components/ProductRange";
import HowItWorks from "@/components/HowItWorks";
import PricingDelivery from "@/components/PricingDelivery";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import { getSellableProducts } from "@/lib/catalogue.server";

// The product cards come from the catalogue in MySQL, which is editable from
// /admin — render per-request rather than freezing the grid at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getSellableProducts();

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <ProductRange products={products} />
        <HowItWorks />
        <PricingDelivery />
        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
