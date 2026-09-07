import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronRight, FileDown } from "lucide-react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { formatPence } from "@/lib/orderOfServicePricing";
import { getOrder } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";

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
  awaiting_proof: "We are preparing your digital proof and will email it to you shortly.",
  proof_sent: "Your proof has been sent — please check your email and let us know if it is ready to print.",
  approved: "Your proof is approved and your order is queued for printing.",
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
  if (!order) notFound();

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
              <Link href="/orders" className="transition-colors hover:text-primary">
                My Orders
              </Link>
              <ChevronRight size={14} aria-hidden />
              <span className="text-on-surface">{order.orderNumber}</span>
            </nav>

            {placed === "1" && (
              <div className="mb-8 flex items-start gap-3 rounded-2xl border border-soft-sage bg-surface-container-lowest p-6 ambient-shadow">
                <CheckCircle2 size={24} aria-hidden className="mt-0.5 shrink-0 text-secondary" />
                <div>
                  <h2 className="font-display text-2xl text-primary">Thank you — your order is placed</h2>
                  <p className="mt-1 font-body text-on-surface-variant">
                    We have emailed a confirmation to {order.contact.email}. Your digital
                    proof will follow for approval before anything is printed.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-4xl font-semibold leading-tight text-primary md:text-5xl">
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
                {order.items.map((item) => {
                  // Only proofs that have actually been sent (or approved) are
                  // shown — an unreviewed "generated" PDF isn't the customer's yet.
                  const visibleProofs = item.proofs.filter(
                    (proof) => proof.status === "sent" || proof.status === "approved",
                  );
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-display text-xl font-semibold text-on-surface">
                            {item.designName}
                          </h2>
                          <p className="font-body text-sm text-on-surface-variant">
                            {item.quantityCopies} copies · {item.quote.size.label} ·{" "}
                            {item.quote.colour.label} · {item.quote.pages.label} · {item.quote.paper.label}
                          </p>
                          <p className="font-body text-sm text-on-surface-variant">
                            {formatPence(item.unitPricePence)} each
                          </p>
                        </div>
                        <p className="font-display text-xl text-primary">
                          {formatPence(item.lineTotalPence)}
                        </p>
                      </div>
                      {visibleProofs.length > 0 && (
                        <ul className="mt-4 flex flex-wrap gap-2">
                          {visibleProofs.map((proof) => (
                            <li key={proof.id}>
                              <a
                                href={proof.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-container px-4 py-2 font-body text-sm font-medium text-primary-container transition-colors hover:bg-surface-container"
                              >
                                <FileDown size={16} aria-hidden />
                                Proof v{proof.version}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </div>

              <aside className="flex h-fit flex-col gap-6">
                <section className="rounded-2xl border border-soft-sage bg-surface-container-lowest p-6 ambient-shadow">
                  <h2 className="mb-4 font-display text-2xl text-primary">Total</h2>
                  <dl className="space-y-2 font-body text-sm text-on-surface-variant">
                    <div className="flex justify-between gap-4">
                      <dt>Subtotal</dt>
                      <dd className="text-on-surface">{formatPence(order.totals.subtotalPence)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>{order.delivery?.label ?? "Delivery"}</dt>
                      <dd className="text-on-surface">
                        {order.totals.deliveryPence === 0 ? "Free" : formatPence(order.totals.deliveryPence)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-outline-variant/40 pt-4">
                    <span className="font-display text-xl text-on-surface">Paid</span>
                    <span className="font-display text-3xl font-semibold text-primary">
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
