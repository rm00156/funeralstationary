import type { Metadata } from "next";
import Link from "next/link";

import AdminVerifyForm from "@/components/AdminVerifyForm";

export const metadata: Metadata = {
  title: "Admin Sign In | The Funeral Stationery",
  robots: { index: false, follow: false },
};

/**
 * Where an admin sign-in email lands. Opening it spends nothing: mail
 * scanners fetch every link in an email, and would otherwise use up the
 * single-use token before the admin got there. AdminVerifyForm POSTs it to
 * /api/admin/verify as soon as the page runs in a real browser.
 */
export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-paper px-margin-mobile md:px-gutter">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center font-display text-3xl font-medium text-primary">Admin</h1>
        <p className="mb-8 text-center font-body text-on-surface-variant">The Funeral Stationery</p>
        {typeof token === "string" && token ? (
          <AdminVerifyForm token={token} />
        ) : (
          <p
            role="alert"
            className="rounded-lg bg-warn-bg px-4 py-3 font-body text-sm text-warn-text"
          >
            That sign-in link isn&apos;t valid.{" "}
            <Link href="/admin/login" className="link">
              Ask for a new one
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
