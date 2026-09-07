import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { formatPence } from "@/lib/orderOfServicePricing";
import { listOrders } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Orders | The Funeral Stationery",
  robots: { index: false, follow: false },
};

const formatDate = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date)
    : "—";

export default async function OrdersPage() {
  const owner = await readOwner();
  const orders = owner ? await listOrders(owner) : [];

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
              <span className="text-on-surface">My Orders</span>
            </nav>

            <h1 className="mb-6 font-display text-4xl font-semibold leading-tight text-primary md:text-5xl">
              My Orders
            </h1>
            <p className="mb-10 max-w-3xl font-body text-lg text-on-surface-variant">
              Track each order from proof to delivery.
            </p>

            {orders.length === 0 ? (
              <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-10 text-center">
                <Package size={28} className="mx-auto mb-4 text-on-surface-variant" aria-hidden />
                <p className="mb-6 font-body text-base text-on-surface-variant">
                  You have not placed an order yet.
                </p>
                <Link
                  href="/designs"
                  className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-body text-sm font-medium text-on-primary transition-colors hover:bg-on-primary-container"
                >
                  Go to my designs
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 transition-colors hover:border-primary-container/60"
                    >
                      <div>
                        <p className="font-display text-xl font-semibold text-on-surface">
                          {order.orderNumber}
                        </p>
                        <p className="font-body text-sm text-on-surface-variant">
                          Placed {formatDate(order.placedAt)} · {order.itemCount}{" "}
                          {order.itemCount === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <OrderStatusBadge status={order.status} />
                        <span className="font-display text-xl text-primary">
                          {formatPence(order.totalPence)}
                        </span>
                        <ChevronRight size={18} aria-hidden className="text-outline" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
