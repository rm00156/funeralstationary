"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Briefcase,
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  List,
  Package,
  PencilRuler,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

const SECTIONS: { href: string; label: string; icon: LucideIcon; badge?: "orders" | "trade" }[] = [
  { href: "/admin", label: "Today", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: FileText, badge: "orders" },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/trade", label: "Trade accounts", icon: Briefcase, badge: "trade" },
  { href: "/admin/designs", label: "Designs", icon: PencilRuler },
  { href: "/admin/products", label: "Products & prices", icon: Package },
  { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/admin/categories", label: "Categories", icon: List },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/access", label: "Access", icon: ShieldCheck },
];

/**
 * The admin sidebar's sections. Below lg the sidebar is a bar across the top,
 * so the list folds behind a button naming the current section rather than
 * running off the side of a phone. `openOrders` (paid, not yet sent) and `tradeApplications` (waiting
 * for a decision) are counted by the layout.
 */
export default function AdminNav({
  openOrders,
  tradeApplications = 0,
}: {
  openOrders: number;
  /** /trade applications waiting for a decision. */
  tradeApplications?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isCurrent = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  const currentSection = SECTIONS.find(({ href }) => isCurrent(href));
  const CurrentIcon = currentSection?.icon;
  const waiting = openOrders + tradeApplications;

  return (
    <nav aria-label="Admin sections">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="admin-sections"
        className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg bg-white/8 px-3 font-body text-[15px] font-medium text-white lg:hidden"
      >
        {CurrentIcon && <CurrentIcon size={18} aria-hidden />}
        <span>{currentSection?.label ?? "Menu"}</span>
        {!open && waiting > 0 && (
          <span
            className="rounded-full bg-on-plum px-2.5 py-0.5 text-xs font-semibold text-plum-deep"
            aria-label={`${waiting} waiting`}
          >
            {waiting}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-on-plum-muted">
          {open ? "Close" : "Menu"}
          <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <ul id="admin-sections" className={`mt-1 flex-col gap-1 lg:mt-0 lg:flex ${open ? "flex" : "hidden"}`}>
        {SECTIONS.map(({ href, label, icon: Icon, badge }) => {
          const current = isCurrent(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
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
                {badge === "trade" && tradeApplications > 0 && (
                  <span
                    className="ml-auto rounded-full bg-on-plum px-2.5 py-0.5 text-xs font-semibold text-plum-deep"
                    aria-label={`${tradeApplications} ${tradeApplications === 1 ? "application" : "applications"} waiting`}
                  >
                    {tradeApplications}
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
