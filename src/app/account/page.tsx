import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, CircleUserRound } from "lucide-react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OrderList from "@/components/OrderList";
import SavedDesignList from "@/components/SavedDesignList";
import SignInForm from "@/components/SignInForm";
import SignOutButton from "@/components/SignOutButton";
import { safeNextPath } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth.server";
import { listDesigns } from "@/lib/designs.server";
import { listOrders } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";
import { authConfigured } from "@/lib/userSession";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Account | The Funeral Stationery",
  description: "Sign in to see the funeral stationery designs and orders you have saved.",
  robots: { index: false, follow: false },
};

const LINK_ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired. Enter your email and we will send a fresh one.",
  used: "That sign-in link has already been used. Enter your email and we will send a fresh one.",
  invalid: "That sign-in link isn't valid. Enter your email and we will send a fresh one.",
};

const breadcrumbClass = "mb-10 flex items-center gap-2 font-body text-sm text-on-surface-variant";
const titleClass =
  "mb-8 font-display text-4xl font-medium leading-tight text-primary md:text-5xl";
const sectionTitleClass = "font-display text-3xl font-medium text-primary";

type DesignSummaries = Parameters<typeof SavedDesignList>[0]["initialDesigns"];

/**
 * The account page, which is two different pages depending on who is
 * looking:
 *
 * - **Signed in** — "My Account": who you are, Sign out, My Designs, My Orders.
 * - **A guest** — "Sign in": the email form. Only if this browser already
 *   holds designs or orders are they listed underneath, labelled as kept in
 *   this browser, so a guest's work never vanishes behind a login.
 *
 * `?next=` is where a sign-in link lands afterwards (e.g. an order opened
 * on another device); `?error=` explains a spent or expired link.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = authConfigured() ? await getCurrentUser() : null;
  if (user && next) redirect(safeNextPath(next, "/account"));

  const owner = await readOwner();
  const [saved, orders] = owner
    ? await Promise.all([listDesigns(owner), listOrders(owner)])
    : [[], []];
  const designs: DesignSummaries = saved.map((design) => ({
    id: design.id,
    name: design.name,
    pageCount: design.pageCount,
    updatedAt: design.updatedAt.toISOString(),
    templateName: design.templateName,
    productLabel: design.productLabel,
  }));

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-paper px-margin-mobile pt-8 pb-section-gap md:px-gutter">
          <div className="mx-auto max-w-[1200px]">
            {user ? (
              <SignedIn email={user.email} designs={designs} orders={orders} />
            ) : (
              <Guest
                next={safeNextPath(next, "/account")}
                error={error}
                designs={designs}
                orders={orders}
              />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Breadcrumb({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb" className={breadcrumbClass}>
      <Link href="/" className="transition-colors hover:text-primary">
        Home
      </Link>
      <ChevronRight size={14} aria-hidden />
      <span className="text-on-surface">{label}</span>
    </nav>
  );
}

function SignedIn({
  email,
  designs,
  orders,
}: {
  email: string;
  designs: DesignSummaries;
  orders: Awaited<ReturnType<typeof listOrders>>;
}) {
  return (
    <>
      <Breadcrumb label="My Account" />
      <h1 className={titleClass}>My Account</h1>

      <div className="mb-12 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-5 py-4">
        <p className="flex items-center gap-2 font-body text-sm text-on-surface-variant">
          <CircleUserRound size={18} aria-hidden className="text-secondary" />
          Signed in as <span className="font-medium text-on-surface">{email}</span>
        </p>
        <SignOutButton className="rounded-lg border border-outline-variant px-4 py-2 text-sm hover:border-primary-container" />
      </div>

      <section aria-labelledby="account-designs" className="mb-14">
        <h2 id="account-designs" className={`mb-6 ${sectionTitleClass}`}>
          My Designs
        </h2>
        <SavedDesignList initialDesigns={designs} />
      </section>

      <section aria-labelledby="account-orders">
        <h2 id="account-orders" className={`mb-6 ${sectionTitleClass}`}>
          My Orders
        </h2>
        <OrderList orders={orders} />
      </section>
    </>
  );
}

function Guest({
  next,
  error,
  designs,
  orders,
}: {
  next: string;
  error?: string;
  designs: DesignSummaries;
  orders: Awaited<ReturnType<typeof listOrders>>;
}) {
  const openingOrder = next.startsWith("/orders/");
  const hasSomething = designs.length > 0 || orders.length > 0;

  return (
    <>
      <Breadcrumb label="Sign in" />
      <h1 className={titleClass}>{openingOrder ? "Sign in to see your order" : "Sign in"}</h1>

      <div className="mb-14 max-w-2xl rounded-2xl border border-line bg-surface-container-lowest p-8 ambient-shadow">
        <p className="mb-6 font-body text-on-surface-variant">
          {openingOrder
            ? "Enter the email address the order was placed with and we will send you a link that opens it on this device."
            : "Enter your email and we will send you a link to sign in. No password needed. Once you're signed in, your designs and orders are kept safe and you can open them on any device."}
        </p>
        {error && LINK_ERRORS[error] && (
          <p role="alert" className="mb-6 font-body text-sm text-primary">
            {LINK_ERRORS[error]}
          </p>
        )}
        {authConfigured() ? (
          <SignInForm next={next} />
        ) : (
          <p className="font-body text-sm text-on-surface-variant">
            Signing in isn&apos;t available right now. You can still design and order without
            an account.
          </p>
        )}
      </div>

      {hasSomething && (
        <section aria-labelledby="browser-saved">
          <h2 id="browser-saved" className={sectionTitleClass}>
            Saved in this browser
          </h2>
          <p className="mt-2 mb-6 max-w-3xl font-body text-on-surface-variant">
            You aren&apos;t signed in, so these are only kept in this browser. Sign in above and
            they move to your account.
          </p>
          {designs.length > 0 && (
            <div className="mb-10">
              <SavedDesignList initialDesigns={designs} />
            </div>
          )}
          {orders.length > 0 && <OrderList orders={orders} />}
        </section>
      )}
    </>
  );
}
