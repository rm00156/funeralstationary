import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import AdminLogoutButton from "@/components/AdminLogoutButton";
import AdminNav from "@/components/AdminNav";
import { adminOrderCounts } from "@/lib/adminDashboard.server";
import { requireAdmin } from "@/lib/adminSession";
import { SITE_NAME } from "@/lib/site";
import { billingNotice } from "@/lib/siteAccess";
import { getSiteAccess, subscriptionRequired } from "@/lib/siteBilling.server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SIDEBAR_LINK =
  "flex min-h-11 items-center gap-3 rounded-lg px-3 font-body text-[15px] font-medium text-on-plum-muted transition-colors duration-200 hover:bg-white/8 hover:text-white";

/**
 * Every page under /admin (except /admin/login, which sits outside this
 * route group) renders through this layout, so anonymous visitors are
 * redirected before any admin UI is built. This check is UX only — the real
 * security boundary is the isAdmin() check inside every /api/admin/* handler.
 * (After logout the client router cache can briefly serve a stale page;
 * harmless, since every mutation re-checks.)
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  // With the switch off nothing can close, so the billing table isn't read.
  const [notice, counts] = await Promise.all([
    subscriptionRequired() ? getSiteAccess().then(billingNotice) : null,
    adminOrderCounts(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:flex-row">
      <aside className="bg-plum-night text-on-plum lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-4 lg:block lg:px-5 lg:pb-6 lg:pt-7">
          <Link href="/admin" className="block">
            <span className="block font-display text-xl leading-tight text-white lg:text-2xl">{SITE_NAME}</span>
            <span className="mt-1 block font-body text-xs font-medium uppercase tracking-[0.18em] text-on-plum-muted">
              Admin
            </span>
          </Link>
        </div>
        <div className="px-2 pb-3 lg:flex-1 lg:px-3">
          <AdminNav openOrders={counts.awaiting_print + counts.in_production} />
        </div>
        <div className="hidden border-t border-white/10 px-3 py-4 lg:block">
          <Link href="/" className={SIDEBAR_LINK}>
            <ArrowUpRight size={18} aria-hidden />
            View site
          </Link>
          <AdminLogoutButton className={`${SIDEBAR_LINK} w-full`} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {notice && (
          <div role="status" className="bg-warn-bg text-warn-text">
            <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-1 px-margin-mobile py-3 font-body text-sm md:px-gutter">
              <span>{notice}</span>
              <Link href="/admin/billing" className="font-medium underline">
                Go to billing
              </Link>
            </div>
          </div>
        )}
        <main className="flex-1 px-margin-mobile py-8 md:px-gutter lg:py-10">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
        <div className="flex gap-2 border-t border-line px-margin-mobile py-3 lg:hidden">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 font-body text-sm font-medium text-ink-2 hover:bg-mist"
          >
            <ArrowUpRight size={16} aria-hidden />
            View site
          </Link>
          <AdminLogoutButton />
        </div>
      </div>
    </div>
  );
}
