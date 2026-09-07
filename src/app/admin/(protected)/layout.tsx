import type { Metadata } from "next";
import Link from "next/link";

import AdminLogoutButton from "@/components/AdminLogoutButton";
import { requireAdmin } from "@/lib/adminSession";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-outline-variant/40 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-margin-mobile py-3 md:px-gutter">
          <Link href="/admin" className="font-display text-lg text-primary">
            Admin
          </Link>
          <nav aria-label="Admin sections" className="flex items-center gap-1">
            {[
              ["Orders", "/admin/orders"],
              ["Products", "/admin/products"],
              ["Categories", "/admin/categories"],
              ["Templates", "/admin/templates"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:bg-surface-container hover:text-primary"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="rounded-lg px-3 py-2 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:bg-surface-container hover:text-primary"
            >
              View site
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 px-margin-mobile py-8 md:px-gutter">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
