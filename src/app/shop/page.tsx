import type { Metadata } from "next";
import { FileText, Phone, Truck } from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ShopBrowser from "@/components/ShopBrowser";
import { getSellableProducts } from "@/lib/catalogue.server";
import { OPENING_HOURS, ORDER_CUTOFF, PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

// The range comes from the catalogue in MySQL, which is editable from /admin —
// render per-request rather than freezing the grid at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop | The Funeral Stationery",
  description:
    "Funeral stationery for the service and the weeks after — Order of Service booklets, memorial cards and thank you cards, printed on heavyweight paper and delivered anywhere in the UK.",
};

export default async function ShopPage() {
  const products = await getSellableProducts();

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <section className="bg-paper">
          <div className="site-container flex flex-col gap-5 pb-10 pt-10 md:pt-14">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
            <h1 className="type-page">Funeral stationery</h1>
            <p className="max-w-[40em] text-xl text-ink-2">
              Everything for the service and the weeks after. All printed on heavyweight paper and
              delivered anywhere in the UK.
            </p>
          </div>
          <ShopBrowser products={products} />
        </section>

        <section className="bg-mist">
          <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-8 py-14">
            <div className="flex items-start gap-4">
              <Truck size={28} strokeWidth={1.6} aria-hidden className="shrink-0 text-plum" />
              <div>
                <p className="font-semibold">Next-working-day delivery</p>
                <p className="text-base text-ink-2">
                  Order before {ORDER_CUTOFF}, anywhere in the UK.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <FileText size={28} strokeWidth={1.6} aria-hidden className="shrink-0 text-plum" />
              <div>
                <p className="font-semibold">Heavyweight paper</p>
                <p className="text-base text-ink-2">Printed to be kept.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Phone size={28} strokeWidth={1.6} aria-hidden className="shrink-0 text-plum" />
              <div>
                <p className="font-semibold">Need a hand?</p>
                <p className="text-base text-ink-2">
                  Call{" "}
                  <a href={PHONE_HREF} className="link">
                    {PHONE_DISPLAY}
                  </a>
                  , {OPENING_HOURS}.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
