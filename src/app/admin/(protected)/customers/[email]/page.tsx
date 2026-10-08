import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, Phone } from "lucide-react";

import OrderStatusBadge from "@/components/OrderStatusBadge";
import { adminGetCustomer } from "@/lib/adminCustomers.server";
import { shortDay } from "@/lib/adminDashboard";
import { formatPence } from "@/lib/orderOfServicePricing";

export const dynamic = "force-dynamic";

const formatDate = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date) : "—";

/** The segment arrives encoded or not depending on how it was reached; decode once, safely. */
function emailParam(raw: string): string {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 ambient-shadow">
      <p className="font-body text-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-3xl text-on-surface">{children}</p>
    </div>
  );
}

export default async function AdminCustomerPage({ params }: PageProps<"/admin/customers/[email]">) {
  const { email } = await params;
  const customer = await adminGetCustomer(emailParam(email));
  if (!customer) notFound();
  const { summary } = customer;
  const phoneHref = summary.phone ? `tel:${summary.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 font-body text-sm text-on-surface-variant">
        <Link href="/admin/customers" className="transition-colors hover:text-primary">
          Customers
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-on-surface">{summary.name ?? summary.email}</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-primary">{summary.name ?? summary.email}</h1>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            {summary.account
              ? `Account since ${formatDate(summary.account.createdAt)}`
              : "Guest — orders without an account"}
            {summary.firstOrderAt && ` · first order ${formatDate(summary.firstOrderAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:${summary.email}`} className="btn btn-outline min-h-11 px-4 text-base">
            <Mail size={16} aria-hidden />
            Email
          </a>
          {phoneHref && (
            <a href={phoneHref} className="btn btn-outline min-h-11 px-4 text-base">
              <Phone size={16} aria-hidden />
              Call
            </a>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Fact label="Orders">{summary.orderCount}</Fact>
        <Fact label="Spent">{formatPence(summary.spentPence)}</Fact>
        <Fact label="Refunded">{formatPence(customer.refundedPence)}</Fact>
        <Fact label="Last order">
          <span className="text-2xl">{formatDate(summary.lastOrderAt)}</span>
        </Fact>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
          <h2 className="px-6 pb-4 pt-6 font-display text-xl text-primary">Orders</h2>
          {customer.orders.length === 0 ? (
            <p className="px-6 pb-6 font-body text-sm text-on-surface-variant">
              No paid orders yet — they have an account and may have saved designs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-y border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                    <th className="px-6 py-3">Order</th>
                    <th className="px-6 py-3">Placed</th>
                    <th className="px-6 py-3">Products</th>
                    <th className="px-6 py-3">Service</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-outline-variant/20 font-body text-sm text-on-surface last:border-b-0"
                    >
                      <td className="px-6 py-3">
                        <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-on-surface-variant">{formatDate(order.placedAt)}</td>
                      <td className="px-6 py-3 text-on-surface-variant">{order.products.join(", ") || "—"}</td>
                      <td className="px-6 py-3 text-on-surface-variant">
                        {order.serviceDate ? shortDay(order.serviceDate) : "—"}
                      </td>
                      <td className="px-6 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        {formatPence(order.totalPence)}
                        {order.refundedPence > 0 && (
                          <span className="block text-xs text-on-surface-variant">
                            {formatPence(order.refundedPence)} refunded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow">
            <h2 className="mb-4 font-display text-xl text-primary">Contact</h2>
            <p className="break-all font-body text-sm text-on-surface">{summary.email}</p>
            {summary.phone && <p className="font-body text-sm text-on-surface-variant">{summary.phone}</p>}
            {customer.address?.line1 && (
              <address className="mt-3 font-body text-sm not-italic leading-relaxed text-on-surface-variant">
                {customer.address.line1}
                <br />
                {customer.address.line2 && (
                  <>
                    {customer.address.line2}
                    <br />
                  </>
                )}
                {customer.address.city}
                <br />
                {customer.address.postcode}
              </address>
            )}
            <p className="mt-3 font-body text-xs text-on-surface-variant">From their most recent order.</p>
          </section>

          {summary.account && (
            <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow">
              <h2 className="mb-4 font-display text-xl text-primary">Account</h2>
              <dl className="grid grid-cols-[1fr_auto] gap-y-2 font-body text-sm">
                <dt className="text-on-surface-variant">Saved designs</dt>
                <dd className="text-right text-on-surface">{customer.savedDesigns}</dd>
                <dt className="text-on-surface-variant">Uploaded files</dt>
                <dd className="text-right text-on-surface">{customer.uploads}</dd>
              </dl>
              <p className="mt-3 font-body text-xs text-on-surface-variant">
                They sign in by emailed link, so there is no password to reset.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
