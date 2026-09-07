import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileDown } from "lucide-react";

import AdminOrderProofActions from "@/components/AdminOrderProofActions";
import AdminPrintPdfButton from "@/components/AdminPrintPdfButton";
import AdminOrderStatusForm from "@/components/AdminOrderStatusForm";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { adminGetOrder } from "@/lib/adminOrders.server";
import { formatPence } from "@/lib/orderOfServicePricing";
import { ORDER_STATUS_LABELS } from "@/lib/orders";

export const dynamic = "force-dynamic";

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

const PROOF_STATUS_LABELS: Record<string, string> = {
  generated: "Generated",
  sent: "Sent to customer",
  changes_requested: "Changes requested",
  approved: "Approved",
};

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
  const order = await adminGetOrder(id);
  if (!order) notFound();

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
          <h1 className="font-display text-3xl font-semibold text-primary">{order.orderNumber}</h1>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            Placed {formatDateTime(order.placedAt)} · paid {formatDateTime(order.paidAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

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
                        {item.quantityCopies} copies · {item.quote.size.label} · {item.quote.colour.label} ·{" "}
                        {item.quote.pages.label} · {item.quote.paper.label}
                      </p>
                      <p className="font-body text-xs text-on-surface-variant">
                        {formatPence(item.unitPricePence)} each · template {item.templateId}
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

                  <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    {item.proofs.length === 0 ? (
                      <p className="font-body text-sm text-on-surface-variant">No proof yet.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {item.proofs.map((proof) => {
                          const label = `v${proof.version} · ${PROOF_STATUS_LABELS[proof.status] ?? proof.status}`;
                          return (
                            <li
                              key={proof.id}
                              className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-1.5"
                            >
                              <span className="font-body text-xs font-medium text-on-surface">
                                {label} · {proof.pages.length}pp
                              </span>
                              {/* The press file is rendered on demand, so a
                                  version the customer has already approved
                                  may not have one yet. */}
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
                        <span className="block text-on-surface-variant">{event.note}</span>
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
            <AdminOrderStatusForm orderId={order.id} status={order.status} />
          </Section>

          <Section title="Customer">
            <p className="font-body text-sm text-on-surface">{order.contact.name ?? "—"}</p>
            <p className="font-body text-sm text-on-surface-variant">{order.contact.email ?? "—"}</p>
            {order.contact.phone && (
              <p className="font-body text-sm text-on-surface-variant">{order.contact.phone}</p>
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
                <dt>{order.delivery?.label ?? "Delivery"}</dt>
                <dd className="text-on-surface">{formatPence(order.totals.deliveryPence)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>VAT ({Math.round(order.totals.vatRate * 100)}%, included)</dt>
                <dd className="text-on-surface">{formatPence(order.totals.vatPence)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-outline-variant/40 pt-2 font-medium">
                <dt className="text-on-surface">Total</dt>
                <dd className="text-primary">{formatPence(order.totals.totalPence)}</dd>
              </div>
            </dl>
            <p className="mt-4 break-all font-body text-xs text-on-surface-variant">
              Stripe session {order.stripe.checkoutSessionId ?? "—"}
              <br />
              Payment intent {order.stripe.paymentIntentId ?? "—"}
            </p>
          </Section>
        </div>
      </div>
    </>
  );
}
