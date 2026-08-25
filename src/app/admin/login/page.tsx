import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminLoginForm from "@/components/AdminLoginForm";
import { isAdmin } from "@/lib/adminSession";

export const metadata: Metadata = {
  title: "Admin Sign In | The Funeral Stationery",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-surface px-margin-mobile md:px-gutter">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center font-display text-3xl font-semibold text-primary">
          Admin
        </h1>
        <p className="mb-8 text-center font-body text-on-surface-variant">
          The Funeral Stationery
        </p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
