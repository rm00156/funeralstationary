import Link from "next/link";
import { PencilLine } from "lucide-react";

import { customerHref } from "@/lib/adminCustomers";
import { adminDesignHref, designOwnerLabel } from "@/lib/adminDesigns";
import type { AdminDesignRow } from "@/lib/adminDesigns.server";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const PILL = "inline-block rounded-full px-3 py-1 font-body text-xs font-medium";

/**
 * Customers' designs with a way into each, for /admin/designs and a
 * customer's page (which leaves out the customer column).
 */
export default function AdminDesignTable({
  designs,
  empty,
  showOwner = true,
}: {
  designs: AdminDesignRow[];
  empty: string;
  showOwner?: boolean;
}) {
  const columns = showOwner ? 6 : 5;
  // A narrow box gets a stacked card per design (name and Edit on top, the rest
  // beneath) rather than a table to scroll sideways; a table once its own box (not the screen) is 48rem.
  return (
    <div className="rounded-xl border border-line bg-surface ambient-shadow @container overflow-x-auto">
      <table className="block w-full text-left @3xl:table @3xl:min-w-[720px]">
        <thead className="hidden @3xl:table-header-group">
          <tr className="border-b border-line font-body text-xs font-medium uppercase tracking-[0.18em] text-star">
            <th className="px-5 py-3">Design</th>
            <th className="px-5 py-3">Product</th>
            {showOwner && <th className="px-5 py-3">Customer</th>}
            <th className="px-5 py-3">Changed</th>
            <th className="px-5 py-3">Orders</th>
            <th className="px-5 py-3">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody className="block @3xl:table-row-group">
          {designs.length === 0 && (
            <tr className="block @3xl:table-row">
              <td colSpan={columns} className="block px-5 py-8 text-center font-body text-sm text-ink-2 @3xl:table-cell">
                {empty}
              </td>
            </tr>
          )}
          {designs.map((design) => (
            <tr
              key={design.id}
              className="row-linked grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 border-b border-line px-5 py-4 font-body text-sm text-ink last:border-b-0 @3xl:table-row @3xl:p-0"
            >
              <td className="col-start-1 @3xl:table-cell @3xl:px-5 @3xl:py-3">
                <span className="block font-medium">{design.name}</span>
                <span className="block text-xs text-ink-2">{design.templateName}</span>
              </td>
              <td className="col-start-1 text-ink-2 @3xl:table-cell @3xl:px-5 @3xl:py-3">{design.productLabel}</td>
              {showOwner && (
                <td className="col-start-1 @3xl:table-cell @3xl:px-5 @3xl:py-3">
                  {design.owner ? (
                    <Link
                      href={customerHref(design.owner.email)}
                      className="block break-all font-medium hover:text-plum hover:underline"
                    >
                      {designOwnerLabel(design.owner)}
                    </Link>
                  ) : (
                    <span className="text-ink-2">Guest</span>
                  )}
                </td>
              )}
              <td className="col-start-1 text-ink-2 @3xl:table-cell @3xl:px-5 @3xl:py-3">
                <span className="@3xl:hidden">Changed </span>
                {formatDate(design.updatedAt)}
              </td>
              <td className="col-start-1 @3xl:table-cell @3xl:px-5 @3xl:py-3">
                <span className="flex flex-wrap gap-1.5">
                  {design.orderState.inBasket && (
                    <span className={`${PILL} bg-mist-3 text-ink`}>In basket</span>
                  )}
                  {design.orderState.orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className={`${PILL} bg-success-border text-success-text hover:underline`}
                    >
                      {order.orderNumber}
                    </Link>
                  ))}
                  {!design.orderState.inBasket && design.orderState.orders.length === 0 && (
                    <span className="text-ink-2">
                      <span className="@3xl:hidden">Not ordered</span>
                      <span className="hidden @3xl:inline">—</span>
                    </span>
                  )}
                </span>
              </td>
              <td className="col-start-2 row-start-1 @3xl:table-cell @3xl:px-5 @3xl:py-3 @3xl:text-right">
                <Link href={adminDesignHref(design.id)} className="row-link btn btn-outline min-h-11 px-4 text-base">
                  <PencilLine size={16} aria-hidden />
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
