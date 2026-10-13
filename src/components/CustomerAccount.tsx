import Link from "next/link";
import { Phone } from "lucide-react";

import AccountOrderCard from "@/components/AccountOrderCard";
import OrderList from "@/components/OrderList";
import SavedDesignList, { type SavedDesignSummary } from "@/components/SavedDesignList";
import SignOutButton from "@/components/SignOutButton";
import { splitLeadOrder } from "@/lib/accountOrders";
import type { OrderSummary } from "@/lib/orders.server";
import { OPENING_HOURS_LONG, PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

const SECTION_TITLE = "font-display text-[30px] font-normal leading-tight text-ink";

/**
 * A family's signed-in /account: the order on its way, their saved designs,
 * their other orders, and help. The trade view is TradeAccount.
 */
export default function CustomerAccount({
  email,
  designs,
  orders,
}: {
  email: string;
  designs: SavedDesignSummary[];
  orders: OrderSummary[];
}) {
  const { lead, rest } = splitLeadOrder(orders);

  return (
    <div className="mx-auto flex max-w-[1150px] flex-col gap-14">
      <div className="flex flex-col gap-2">
        <p className="text-ink-2">Signed in as {email}</p>
        <h1 className="type-page">Your designs and orders</h1>
      </div>

      {lead && <AccountOrderCard order={lead} />}

      <section aria-labelledby="account-designs" className="flex flex-col gap-5">
        <h2 id="account-designs" className={SECTION_TITLE}>
          Saved designs
        </h2>
        <SavedDesignList initialDesigns={designs} />
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="account-orders" className="flex flex-col gap-5">
          <h2 id="account-orders" className={SECTION_TITLE}>
            {lead ? "Earlier orders" : "Your orders"}
          </h2>
          <OrderList orders={rest} />
          <p className="text-base text-ink-2">
            Need extra copies for family who couldn’t make it? A design you made here stays under Saved designs —
            add it to your basket again for as many copies as you need.
          </p>
        </section>
      )}

      {orders.length === 0 && (
        <p className="text-ink-2">
          You haven’t placed an order yet. When you do, you’ll be able to follow it here.
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-6">
        <section className="flex flex-col gap-3 rounded-xl bg-mist p-7 sm:p-8">
          <h2 className="font-display text-2xl font-normal text-ink">Something not right?</h2>
          <p className="text-ink-2">Call us and a real person will help, {OPENING_HOURS_LONG}.</p>
          <a
            href={PHONE_HREF}
            className="flex min-h-11 items-center gap-2.5 self-start text-[22px] font-semibold text-plum no-underline hover:underline"
          >
            <Phone size={20} strokeWidth={1.8} aria-hidden />
            {PHONE_DISPLAY}
          </a>
        </section>
        <section className="flex flex-col rounded-xl border border-line bg-surface p-7 sm:p-8">
          <h2 className="mb-3 font-display text-2xl font-normal text-ink">Your details</h2>
          <p className="border-t border-line py-3 text-base text-ink-2">
            Signed in as <span className="font-medium text-ink [overflow-wrap:anywhere]">{email}</span>
            <span className="block text-[15px] text-ink-3">No password — we email you a link each time.</span>
          </p>
          <Link href="/cart" className="link flex min-h-12 items-center border-t border-line text-base">
            Your basket
          </Link>
          <div className="flex min-h-12 items-center border-t border-line">
            <SignOutButton className="min-h-11 text-base" />
          </div>
        </section>
      </div>
    </div>
  );
}
