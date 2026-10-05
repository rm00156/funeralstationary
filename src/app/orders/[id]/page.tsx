import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import { lineSpec } from "@/lib/orders";
import { getOrder } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";
import { authConfigured } from "@/lib/userSession";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order | The Funeral Stationery",
  robots: { index: false, follow: false },
};

const formatDate = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "—";

const STATUS_NOTES: Partial<Record<string, string>> = {
  awaiting_print: "Your order is confirmed and queued for printing.",
  in_production: "Your stationery is being printed.",
  shipped: "Your order is on its way.",
  delivered: "Your order has been delivered.",
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const [{ id }, { placed }] = await Promise.all([params, searchParams]);
  const owner = await readOwner();
  const order = owner ? await getOrder(owner, id) : null;
  // A guest who can't see this order may simply be on a different device from
  // the one that placed it — the confirmation email is read anywhere. Send
  // them to sign in, for every id alike so nothing is revealed about whether
  // the order exists. A signed-in customer who still can't see it gets a 404.
  if (!order) {
    if (!owner?.userId && authConfigured()) redirect(`/account?next=/orders/${encodeURIComponent(id)}`);
    notFound();
  }

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
              {/* A guest has no "My Account" — only a signed-in customer gets that crumb. */}
              {owner?.userId && (
                <>
                  <Link href="/account" className="transition-colors hover:text-primary">
                    My Account
                  </Link>
                  <ChevronRight size={14} aria-hidden />
                </>
              )}
              <span className="text-on-surface">{order.orderNumber}</span>
            </nav>

            {placed === "1" && (
              <div className="mb-8 flex items-start gap-3 rounded-2xl border border-line bg-surface-container-lowest p-6 ambient-shadow">
                <CheckCircle2 size={24} aria-hidden className="mt-0.5 shrink-0 text-secondary" />
                <div>
                  <h2 className="font-display text-2xl text-primary">
                    Thank you — your order is placed
                  </h2>
                  <p className="mt-1 font-body text-on-surface-variant">
                    We have emailed a confirmation to {order.contact.email}. Your stationery is now
                    queued for printing.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-4xl font-medium leading-tight text-primary md:text-5xl">
                  {order.orderNumber}
                </h1>
                <p className="mt-2 font-body text-on-surface-variant">
                  Placed {formatDate(order.placedAt)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            {STATUS_NOTES[order.status] && (
              <p className="mb-10 max-w-3xl font-body text-lg text-on-surface-variant">
                {STATUS_NOTES[order.status]}
              </p>
            )}

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex flex-col gap-4">
                {order.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-xl font-medium text-on-surface">
                          {item.designName}
                        </h2>
                        <p className="font-body text-sm text-on-surface-variant">
                          {copiesText(item.quantityCopies)} · {lineSpec(item.format, item.quote)}
                        </p>
                        <p className="font-body text-sm text-on-surface-variant">
                          {formatPence(item.unitPricePence)} each
                        </p>
                        <p className="font-body text-sm text-on-surface-variant">
                          {item.delivery.label} ·{" "}
                          {item.delivery.pricePence === 0
                            ? "Free"
                            : formatPence(item.delivery.pricePence)}
                        </p>
                      </div>
                      <p className="font-display text-xl text-primary">
                        {formatPence(item.lineTotalPence)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="flex h-fit flex-col gap-6">
                <section className="rounded-2xl border border-line bg-surface-container-lowest p-6 ambient-shadow">
                  <h2 className="mb-4 font-display text-2xl text-primary">Total</h2>
                  <dl className="space-y-2 font-body text-sm text-on-surface-variant">
                    <div className="flex justify-between gap-4">
                      <dt>Subtotal</dt>
                      <dd className="text-on-surface">{formatPence(order.totals.subtotalPence)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Delivery</dt>
                      <dd className="text-on-surface">
                        {order.totals.deliveryPence === 0
                          ? "Free"
                          : formatPence(order.totals.deliveryPence)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-outline-variant/40 pt-4">
                    <span className="font-display text-xl text-on-surface">Paid</span>
                    <span className="font-display text-3xl font-medium text-primary">
                      {formatPence(order.totals.totalPence)}
                    </span>
                  </div>
                  <p className="mt-1 text-right font-body text-sm text-on-surface-variant">
                    Includes VAT of {formatPence(order.totals.vatPence)}
                  </p>
                </section>

                <section className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6">
                  <h2 className="mb-3 font-display text-xl text-primary">Delivering to</h2>
                  <address className="font-body text-sm not-italic leading-relaxed text-on-surface-variant">
                    {order.contact.name}
                    <br />
                    {order.address.line1}
                    <br />
                    {order.address.line2 && (
                      <>
                        {order.address.line2}
                        <br />
                      </>
                    )}
                    {order.address.city}
                    <br />
                    {order.address.postcode}
                  </address>
                  <p className="mt-3 font-body text-sm text-on-surface-variant">
                    {order.contact.email}
                    {order.contact.phone && (
                      <>
                        <br />
                        {order.contact.phone}
                      </>
                    )}
                  </p>
                </section>
              </aside>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
