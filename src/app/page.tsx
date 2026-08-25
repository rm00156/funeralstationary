import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustStrip from "@/components/TrustStrip";
import ProductRange from "@/components/ProductRange";
import HowItWorks from "@/components/HowItWorks";
import PricingDelivery from "@/components/PricingDelivery";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <ProductRange />
        <HowItWorks />
        <PricingDelivery />
        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
