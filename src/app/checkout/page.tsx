import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import CheckoutForm from "@/components/CheckoutForm";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getCart } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";
import { isStripeConfigured } from "@/lib/stripe.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | The Funeral Stationery",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const owner = await readOwner();
  const cart = owner ? await getCart(owner) : null;
  if (!cart || cart.items.length === 0) redirect("/cart");
  const { cancelled } = await searchParams;

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-surface px-margin-mobile pt-8 pb-section-gap md:px-gutter">
          <div className="mx-auto max-w-[1200px]">
            <nav
              aria-label="Breadcrumb"
              className="mb-10 flex items-center gap-2 font-body text-sm text-on-surface-variant"
            >
              <Link href="/" className="transition-colors hover:text-primary">
                Home
              </Link>
              <ChevronRight size={14} aria-hidden />
              <Link href="/cart" className="transition-colors hover:text-primary">
                Basket
              </Link>
              <ChevronRight size={14} aria-hidden />
              <span className="text-on-surface">Checkout</span>
            </nav>

            <h1 className="mb-6 font-display text-4xl font-semibold leading-tight text-primary md:text-5xl">
              Checkout
            </h1>
            <p className="mb-10 max-w-3xl font-body text-lg text-on-surface-variant">
              Tell us where to send your stationery, then pay securely. Nothing is
              printed until you have approved a digital proof.
            </p>

            <CheckoutForm
              cart={cart}
              cancelled={cancelled === "1"}
              paymentsConfigured={isStripeConfigured()}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
