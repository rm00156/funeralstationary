import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import CartView from "@/components/CartView";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ShopClosedNotice from "@/components/ShopClosedNotice";
import { getCart } from "@/lib/orders.server";
import { getPricingData } from "@/lib/pricing.server";
import { readOwner } from "@/lib/session";
import { isShopOpen } from "@/lib/siteBilling.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Basket | The Funeral Stationery",
  description: "Review the stationery you have designed, choose quantities and delivery, and check out.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const [owner, shopOpen] = await Promise.all([readOwner(), isShopOpen()]);
  const cart = owner ? await getCart(owner) : null;
  // Each line's option lists come from its own product — a basket can hold
  // several. getPricingData is request-cached, so repeats are free.
  const productIds = [...new Set(cart?.items.map((item) => item.productId) ?? [])];
  const pricingByProduct = Object.fromEntries(
    await Promise.all(
      productIds.map(async (productId) => [productId, await getPricingData(productId)] as const),
    ),
  );

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-paper px-margin-mobile pt-8 pb-section-gap md:px-gutter">
          <div className="mx-auto max-w-[1200px]">
            <nav
              aria-label="Breadcrumb"
              className="mb-10 flex items-center gap-2 font-body text-sm text-on-surface-variant"
            >
              <Link href="/" className="transition-colors hover:text-primary">
                Home
              </Link>
              <ChevronRight size={14} aria-hidden />
              <span className="text-on-surface">Basket</span>
            </nav>

            <h1 className="mb-6 font-display text-4xl font-medium leading-tight text-primary md:text-5xl">
              Your Basket
            </h1>
            <p className="mb-10 max-w-3xl font-body text-lg text-on-surface-variant">
              Choose how many copies you need and how you would like them
              delivered. The price updates as you go.
            </p>

            {!shopOpen && <ShopClosedNotice />}
            {/* Closed, the basket stays readable and removable — only changing it and paying are refused. */}
            {(shopOpen || (cart && cart.items.length > 0)) && (
              <div className={shopOpen ? undefined : "mt-10"}>
                <CartView initialCart={cart} pricingByProduct={pricingByProduct} closed={!shopOpen} />
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
