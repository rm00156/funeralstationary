"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  List,
  Package,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

const SECTIONS: { href: string; label: string; icon: LucideIcon; badge?: "orders" }[] = [
  { href: "/admin", label: "Today", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: FileText, badge: "orders" },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/products", label: "Products & prices", icon: Package },
  { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/admin/categories", label: "Categories", icon: List },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/access", label: "Access", icon: ShieldCheck },
];

/**
 * The admin sidebar's sections. A client component only to mark the current
 * one; `openOrders` (paid, not yet sent) is counted by the layout.
 */
export default function AdminNav({ openOrders }: { openOrders: number }) {
  const pathname = usePathname();
  const isCurrent = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Admin sections">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {SECTIONS.map(({ href, label, icon: Icon, badge }) => {
          const current = isCurrent(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 font-body text-[15px] font-medium transition-colors duration-200 ${
                  current ? "bg-white/12 text-white" : "text-on-plum-muted hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon size={18} aria-hidden />
                <span className="whitespace-nowrap">{label}</span>
                {badge === "orders" && openOrders > 0 && (
                  <span
                    className="ml-auto rounded-full bg-on-plum px-2.5 py-0.5 text-xs font-semibold text-plum-deep"
                    aria-label={`${openOrders} to print or printing`}
                  >
                    {openOrders}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
