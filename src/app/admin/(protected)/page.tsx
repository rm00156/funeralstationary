import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { adminCountOrders } from "@/lib/adminOrders.server";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/admin/orders",
    title: "Orders",
    description: "Paid orders: send proofs, move them through production, see their history.",
  },
  {
    href: "/admin/products",
    title: "Products",
    description: "Product range and the pricing options behind every quote.",
  },
  {
    href: "/admin/categories",
    title: "Categories",
    description: "Template categories, their accent colours and ordering.",
  },
  {
    href: "/admin/templates",
    title: "Templates",
    description: "Template catalogue, preview artwork and starter layouts.",
  },
];

export default async function AdminDashboardPage() {
  const awaitingPrint = await adminCountOrders("awaiting_print");
  return (
    <>
      <h1 className="mb-8 font-display text-3xl font-semibold text-primary">
        Dashboard
      </h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow transition-transform duration-300 hover:-translate-y-1"
          >
            <h2 className="mb-2 flex items-center justify-between font-display text-xl text-on-surface">
              <span className="flex items-center gap-3">
                {section.title}
                {section.href === "/admin/orders" && awaitingPrint > 0 && (
                  <span className="rounded-full bg-primary-container px-2.5 py-0.5 font-body text-xs font-medium text-white">
                    {awaitingPrint} awaiting print
                  </span>
                )}
              </span>
              <ArrowRight
                size={18}
                aria-hidden
                className="text-outline transition-colors group-hover:text-primary"
              />
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
