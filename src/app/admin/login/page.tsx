import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminLoginForm from "@/components/AdminLoginForm";
import { adminLinkError } from "@/lib/adminAccess";
import { isAdmin } from "@/lib/adminAuth.server";
import { adminConfigured } from "@/lib/adminSession";

export const metadata: Metadata = {
  title: "Admin Sign In | The Funeral Stationery",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin");
  const { email, error } = await searchParams;
  const linkError = adminLinkError(error);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-paper px-margin-mobile md:px-gutter">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center font-display text-3xl font-medium text-primary">
          Admin
        </h1>
        <p className="mb-8 text-center font-body text-on-surface-variant">
          The Funeral Stationery
        </p>
        {linkError && (
          <p role="alert" className="mb-4 rounded-lg bg-warn-bg px-4 py-3 font-body text-sm text-warn-text">
            {linkError}
          </p>
        )}
        {adminConfigured() ? (
          <AdminLoginForm initialEmail={typeof email === "string" ? email : ""} />
        ) : (
          <p className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 font-body text-on-surface-variant ambient-shadow">
            Admin sign-in is switched off until <code>AUTH_SECRET</code> is set on the server.
          </p>
        )}
      </div>
    </main>
  );
}
