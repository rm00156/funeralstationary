import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, FileDown } from "lucide-react";

import AdminOrderProofActions from "@/components/AdminOrderProofActions";
import AdminPrintPdfButton from "@/components/AdminPrintPdfButton";
import AdminOrderStatusForm from "@/components/AdminOrderStatusForm";
import AdminThintentButton from "@/components/AdminThintentButton";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { customerHref } from "@/lib/adminCustomers";
import { adminOrderCustomerEmail } from "@/lib/adminCustomers.server";
import { adminGetOrder } from "@/lib/adminOrders.server";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import { fileSizeText } from "@/lib/artwork";
import { trimText } from "@/lib/designEditor";
import { ORDER_STATUS_LABELS, lineSpec, refundStatusEffect, refundedPence } from "@/lib/orders";
import { canSendToThintent } from "@/lib/thintent";
import { isThintentConfigured } from "@/lib/thintent.server";
import { vatRateLabel } from "@/lib/vat";

/** Stripe's dashboard page for a payment; test-mode payments live under /test. */
function stripePaymentUrl(paymentIntentId: string): string {
  const mode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "test/" : "";
  return `https://dashboard.stripe.com/${mode}payments/${paymentIntentId}`;
}

export const dynamic = "force-dynamic";

/** A YYYY-MM-DD service date, as "Tue 13 Oct 2026". */
const formatServiceDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

const formatDateTime = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "—";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow">
      <h2 className="mb-4 font-display text-xl text-primary">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const [order, customerEmail] = await Promise.all([adminGetOrder(id), adminOrderCustomerEmail(id)]);
  if (!order) notFound();
  const refunded = refundedPence(order.refunds);
  const refundsNotInThintent = order.thintent
    ? order.refunds.filter((refund) => refund.status === "succeeded" && !refund.thintentCreditRef).length
    : 0;

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 font-body text-sm text-on-surface-variant"
      >
        <Link href="/admin/orders" className="transition-colors hover:text-primary">
          Orders
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-on-surface">{order.orderNumber}</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-primary">{order.orderNumber}</h1>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            Placed {formatDateTime(order.placedAt)} · paid {formatDateTime(order.paidAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* A cancel never moves money (it can come from a Thintent webhook):
          the refund is made in Stripe, and the order settles to Refunded by itself. */}
      {order.status === "cancelled" && order.paidAt && refunded < order.totals.totalPence && (
        <div className="mb-8 rounded-xl bg-warn-bg px-6 py-4 font-body text-sm text-warn-text">
          <p className="font-medium">Refund needed?</p>
          <p className="mt-1">
            This order was cancelled after the customer paid {formatPence(order.totals.totalPence)}.{" "}
            {refunded > 0 ? `${formatPence(refunded)} has been refunded so far.` : "Nothing has been refunded yet."}{" "}
            Refund it in Stripe if that’s due — the order moves to Refunded by itself once it’s refunded in full.
          </p>
        </div>
      )}
      {refundStatusEffect(order.status, refunded, order.totals.totalPence) === "still-printing" && (
        <div className="mb-8 rounded-xl bg-warn-bg px-6 py-4 font-body text-sm text-warn-text">
          <p className="font-medium">Refunded, but still going to print</p>
          <p className="mt-1">
            The customer has been refunded in full. If this order shouldn’t be printed, cancel the job in Thintent.
          </p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-8">
          <Section title="Items">
            <ul className="divide-y divide-outline-variant/30">
              {order.items.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-body font-medium text-on-surface">{item.designName}</p>
                      <p className="font-body text-sm text-on-surface-variant">
                        {copiesText(item.quantityCopies)} · {lineSpec(item.format, item.quote)}
                        {item.format.sizedByOption &&
                          ` — artwork drawn at ${trimText(item.artworkTrim)}; scale to the size ordered`}
                      </p>
                      {item.serviceDate && (
                        <p className="font-body text-sm font-medium text-on-surface">
                          Service on {formatServiceDate(item.serviceDate)}
                        </p>
                      )}
                      <p className="font-body text-xs text-on-surface-variant">
                        {formatPence(item.unitPricePence)} each · {item.delivery.label} (
                        {formatPence(item.delivery.pricePence)})
                        {item.templateId ? ` · template ${item.templateId}` : " · customer’s own artwork"}
                        {item.designId && (
                          <>
                            {" · "}
                            <Link href={`/design?design=${item.designId}`} className="underline hover:text-primary">
                              open design
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <p className="font-display text-lg text-primary">{formatPence(item.lineTotalPence)}</p>
                  </div>

                  {item.artwork ? (
                    <div className="mt-3 rounded-lg bg-surface-container px-4 py-3 font-body text-sm">
                      {item.artwork.source === "pdf" && item.artwork.url ? (
                        <a
                          href={item.artwork.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-primary-container underline-offset-2 hover:underline"
                        >
                          <FileDown size={14} aria-hidden />
                          Customer’s PDF — {item.artwork.fileName}
                          {item.artwork.byteSize ? ` (${fileSizeText(item.artwork.byteSize)})` : ""}
                        </a>
                      ) : (
                        <>
                          <a
                            href={item.artwork.canvaUrl ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 break-all font-medium text-primary-container underline-offset-2 hover:underline"
                          >
                            <ExternalLink size={14} aria-hidden />
                            Canva design
                          </a>
                          <p className="mt-1 text-on-surface-variant">
                            Not checked yet — download it as PDF Print with bleed, and check the size,
                            pages, photos and fonts before it goes to press.
                          </p>
                        </>
                      )}
                      {item.artwork.pageCount !== null && (
                        <p className="mt-1 text-on-surface-variant">
                          {item.artwork.pageCount} {item.artwork.pageCount === 1 ? "page" : "pages"} in the file ·
                          cut to {trimText(item.artwork.trim)}
                        </p>
                      )}
                      {item.artwork.checks.some((check) => check.status !== "pass") && (
                        <div className="mt-2">
                          <p className="font-medium text-on-surface">
                            Customer chose to print it as it is
                            {item.artwork.warningsAcceptedAt &&
                              `, ${formatDateTime(new Date(item.artwork.warningsAcceptedAt))}`}
                            :
                          </p>
                          <ul className="mt-1 list-disc pl-5 text-on-surface-variant">
                            {item.artwork.checks
                              .filter((check) => check.status !== "pass")
                              .map((check) => (
                                <li key={check.id}>
                                  {check.title}. {check.detail}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Wording confirmed by the customer {formatDateTime(new Date(item.artwork.confirmedAt))}.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                      {item.proofs.length === 0 ? (
                        <p className="font-body text-sm text-on-surface-variant">No proof yet.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {item.proofs.map((proof) => {
                            const label = `v${proof.version}`;
                            return (
                              <li
                                key={proof.id}
                                className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-1.5"
                              >
                                <span className="font-body text-xs font-medium text-on-surface">
                                  {label} · {proof.pages.length}pp
                                </span>
                                {/* The press file is rendered on demand, so a
                                    version may not have one yet. */}
                                {proof.pdfUrl ? (
                                  <a
                                    href={proof.pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-body text-xs font-medium text-primary-container underline-offset-2 hover:underline"
                                  >
                                    <FileDown size={12} aria-hidden />
                                    print PDF
                                  </a>
                                ) : (
                                  <AdminPrintPdfButton orderId={order.id} proofId={proof.id} />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <AdminOrderProofActions
                        orderId={order.id}
                        itemId={item.id}
                        hasProof={item.proofs.length > 0}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="History">
            {order.events.length === 0 ? (
              <p className="font-body text-sm text-on-surface-variant">Nothing recorded yet.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {order.events.map((event) => (
                  <li key={event.id} className="flex gap-4 font-body text-sm">
                    <span className="w-36 shrink-0 text-on-surface-variant">
                      {formatDateTime(event.createdAt)}
                    </span>
                    <span>
                      <span className="font-medium text-on-surface">
                        {event.type === "status_changed" && event.toStatus
                          ? `Status → ${ORDER_STATUS_LABELS[event.toStatus as keyof typeof ORDER_STATUS_LABELS] ?? event.toStatus}`
                          : event.type.replace(/_/g, " ")}
                      </span>
                      {event.actor && <span className="text-on-surface-variant"> · {event.actor}</span>}
                      {event.note && (
                        <span className="block text-on-surface-variant">{event.note.replace(/ \(cs_\w+\)$/, "")}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-8">
          <Section title="Status">
            <AdminOrderStatusForm
              orderId={order.id}
              status={order.status}
              thintentJobRef={order.thintent?.jobRef ?? null}
            />
          </Section>

          {(order.thintent || (isThintentConfigured() && order.paidAt)) && (
            <Section title="Thintent">
              {order.thintent ? (
                <>
                  <p className="font-body text-sm text-on-surface">
                    Managed in Thintent as job #{order.thintent.jobRef}.
                  </p>
                  {order.thintent.jobUrl && (
                    <a
                      href={order.thintent.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 font-body text-sm font-medium text-primary hover:underline"
                    >
                      <ExternalLink size={14} aria-hidden />
                      Open the job in Thintent
                    </a>
                  )}
                  <p className="mt-2 font-body text-xs text-on-surface-variant">
                    Moving the job there — dispatching, completing or cancelling it — moves this order too.
                    Refunds made in Stripe are recorded there as credit notes.
                  </p>
                  {refundsNotInThintent > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 font-body text-sm text-on-surface-variant">
                        {refundsNotInThintent === 1 ? "1 refund isn’t" : `${refundsNotInThintent} refunds aren’t`} in
                        Thintent yet. It is retried every hour, or send it now.
                      </p>
                      <AdminThintentButton orderId={order.id} label="Send refunds to Thintent" />
                    </div>
                  )}
                </>
              ) : canSendToThintent(order.status) ? (
                <>
                  <p className="mb-3 font-body text-sm text-on-surface-variant">
                    Not in Thintent yet. It is retried every hour, or send it now.
                  </p>
                  <AdminThintentButton orderId={order.id} />
                </>
              ) : (
                <p className="font-body text-sm text-on-surface-variant">
                  Not in Thintent. It has moved on from awaiting print here, so it isn’t sent — that would make a
                  second job for work already under way.
                </p>
              )}
            </Section>
          )}

          <Section title="Customer">
            <p className="font-body text-sm text-on-surface">{order.contact.name ?? "—"}</p>
            <p className="font-body text-sm text-on-surface-variant">{order.contact.email ?? "—"}</p>
            {order.contact.phone && (
              <p className="font-body text-sm text-on-surface-variant">{order.contact.phone}</p>
            )}
            {customerEmail && order.status !== "draft" && (
              <Link href={customerHref(customerEmail)} className="link mt-2 inline-block font-body text-sm">
                All their orders
              </Link>
            )}
            <address className="mt-3 font-body text-sm not-italic leading-relaxed text-on-surface-variant">
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
              {order.address.postcode} · {order.address.country}
            </address>
          </Section>

          <Section title="Payment">
            <dl className="space-y-2 font-body text-sm text-on-surface-variant">
              <div className="flex justify-between gap-4">
                <dt>Subtotal</dt>
                <dd className="text-on-surface">{formatPence(order.totals.subtotalPence)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Delivery</dt>
                <dd className="text-on-surface">{formatPence(order.totals.deliveryPence)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>VAT ({vatRateLabel(order.items.map((item) => item.vatTreatment))}, included)</dt>
                <dd className="text-on-surface">{formatPence(order.totals.vatPence)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-outline-variant/40 pt-2 font-medium">
                <dt className="text-on-surface">Total</dt>
                <dd className="text-primary">{formatPence(order.totals.totalPence)}</dd>
              </div>
              {order.refunds.map((refund) => (
                <div key={refund.stripeRefundId} className="flex justify-between gap-4">
                  <dt>
                    Refund, {formatDateTime(refund.refundedAt)}
                    {refund.status !== "succeeded" && ` (${refund.status.replace(/_/g, " ")})`}
                    {refund.thintentCreditRef && ` · Thintent ${refund.thintentCreditRef}`}
                  </dt>
                  <dd className={refund.status === "succeeded" ? "text-on-surface" : "line-through"}>
                    −{formatPence(refund.amountPence)}
                  </dd>
                </div>
              ))}
              {refunded > 0 && (
                <div className="flex justify-between gap-4 border-t border-outline-variant/40 pt-2 font-medium">
                  <dt className="text-on-surface">Kept</dt>
                  <dd className="text-primary">{formatPence(order.totals.totalPence - refunded)}</dd>
                </div>
              )}
            </dl>
            {order.stripe.paymentIntentId && (
              <a
                href={stripePaymentUrl(order.stripe.paymentIntentId)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 font-body text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink size={14} aria-hidden />
                View payment in Stripe
              </a>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
