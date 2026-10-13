import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Breadcrumb from "@/components/Breadcrumb";
import CustomerAccount from "@/components/CustomerAccount";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OrderList from "@/components/OrderList";
import SavedDesignList, { type SavedDesignSummary } from "@/components/SavedDesignList";
import SignInForm from "@/components/SignInForm";
import TradeAccount from "@/components/TradeAccount";
import { safeNextPath } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth.server";
import { getSellableProducts } from "@/lib/catalogue.server";
import { listDesigns } from "@/lib/designs.server";
import { listOrders, type OrderSummary } from "@/lib/orders.server";
import { readOwner } from "@/lib/session";
import { getCurrentTradeMembership } from "@/lib/trade.server";
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

const SECTION_TITLE = "font-display text-[30px] font-normal leading-tight text-ink";

/**
 * The account page, which is three different pages depending on who is
 * looking. Signing in is the same for all of them (an emailed link); what
 * differs is only what the proven email is:
 *
 * - **A trade account** — the email is on an active firm (trade.server.ts):
 *   the firm's view, TradeAccount.
 * - **Signed in** — a family's: the order on its way, saved designs, other
 *   orders, CustomerAccount.
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
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
}) {
  const { next, error, email } = await searchParams;
  const user = authConfigured() ? await getCurrentUser() : null;
  if (user && next) redirect(safeNextPath(next, "/account"));

  const owner = await readOwner();
  const [saved, orders, membership] = await Promise.all([
    owner ? listDesigns(owner) : [],
    owner ? listOrders(owner) : [],
    user ? getCurrentTradeMembership() : null,
  ]);
  const designs: SavedDesignSummary[] = saved.map((design) => ({
    id: design.id,
    name: design.name,
    pageCount: design.pageCount,
    updatedAt: design.updatedAt.toISOString(),
    templateName: design.templateName,
    templateImage: design.templateImage,
    productLabel: design.productLabel,
  }));

  let content: React.ReactNode;
  if (user && membership) {
    const products = await getSellableProducts();
    content = (
      <TradeAccount
        membership={membership}
        email={user.email}
        designCount={products.reduce((sum, product) => sum + product.templateCount, 0)}
        designs={designs}
        orders={orders}
        now={new Date()}
      />
    );
  } else if (user) {
    content = <CustomerAccount email={user.email} designs={designs} orders={orders} />;
  } else {
    content = (
      <Guest
        next={safeNextPath(next, "/account")}
        error={error}
        initialEmail={typeof email === "string" ? email.slice(0, 255) : ""}
        designs={designs}
        orders={orders}
      />
    );
  }

  return (
    <>
      <Header />
      <main className="type-body flex-1 bg-paper">
        <div className="site-container pb-24 pt-10 md:pt-14">{content}</div>
      </main>
      <Footer />
    </>
  );
}

function Guest({
  next,
  error,
  initialEmail,
  designs,
  orders,
}: {
  next: string;
  error?: string;
  /** From a "your trade account is ready" email (accountSignInPageUrl). */
  initialEmail: string;
  designs: SavedDesignSummary[];
  orders: OrderSummary[];
}) {
  const openingOrder = next.startsWith("/orders/");
  const hasSomething = designs.length > 0 || orders.length > 0;

  return (
    <div className="mx-auto flex max-w-[1150px] flex-col gap-12">
      <div className="flex flex-col gap-5">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Sign in" }]} />
        <h1 className="type-page">{openingOrder ? "Sign in to see your order" : "Sign in"}</h1>
      </div>

      <div className="max-w-2xl rounded-2xl border border-line bg-surface p-7 sm:p-10">
        <p className="mb-6 text-ink-2">
          {openingOrder
            ? "Enter the email address the order was placed with and we will send you a link that opens it on this device."
            : "Enter your email and we will send you a link to sign in. No password needed. Once you're signed in, your designs and orders are kept safe and you can open them on any device. Funeral directors with a trade account sign in here too."}
        </p>
        {error && LINK_ERRORS[error] && (
          <p role="alert" className="mb-6 text-base font-medium text-plum">
            {LINK_ERRORS[error]}
          </p>
        )}
        {authConfigured() ? (
          <SignInForm next={next} initialEmail={initialEmail} />
        ) : (
          <p className="text-base text-ink-2">
            Signing in isn&apos;t available right now. You can still design and order without an
            account.
          </p>
        )}
      </div>

      {hasSomething && (
        <section aria-labelledby="browser-saved" className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 id="browser-saved" className={SECTION_TITLE}>
              Saved in this browser
            </h2>
            <p className="max-w-3xl text-ink-2">
              You aren&apos;t signed in, so these are only kept in this browser. Sign in above and
              they move to your account.
            </p>
          </div>
          {designs.length > 0 && <SavedDesignList initialDesigns={designs} />}
          {orders.length > 0 && <OrderList orders={orders} />}
        </section>
      )}
    </div>
  );
}
