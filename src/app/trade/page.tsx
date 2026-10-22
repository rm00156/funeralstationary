import type { Metadata } from "next";
import Link from "next/link";
import { Clock, FileText, Image as ImageIcon, MessagesSquare, Package, Phone, Tag } from "lucide-react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import TradeApplicationForm from "@/components/TradeApplicationForm";
import { getSellableProducts } from "@/lib/catalogue.server";
import {
  ADDRESS_LINES,
  OPENING_HOURS,
  ORDER_CUTOFF,
  PHONE_DISPLAY,
  PHONE_HREF,
  PRINT_TURNAROUND,
} from "@/lib/site";
import { tradeOrderTypes } from "@/lib/tradeApplication";

// The order-type boxes, header and footer read the live catalogue.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade accounts for funeral directors | The Funeral Stationery",
  description:
    "Open a trade account for trade prices, payment on invoice and funeral stationery that arrives in time for the service, every time.",
};

const BENEFITS = [
  {
    icon: Tag,
    title: "Trade prices",
    body: "Your own prices on every product, agreed with you when we set up your account.",
  },
  {
    icon: FileText,
    title: "Pay on invoice",
    body: "We invoice you and you pay within your agreed terms, with the family named on every invoice.",
  },
  {
    icon: Clock,
    title: "Ready in time",
    body: `Printed within ${PRINT_TURNAROUND}, then sent to you or straight to the family. Order by ${ORDER_CUTOFF} on a working day for next-working-day delivery.`,
  },
  {
    icon: Package,
    title: "Plain, unbranded delivery",
    body: "Nothing with our name on it, so the stationery comes from you.",
  },
  {
    icon: ImageIcon,
    title: "Your logo, if you want it",
    body: "Add your firm’s name or logo to the back of booklets and cards.",
  },
  {
    icon: MessagesSquare,
    title: "One team who knows you",
    body: "Call the same people every time. We’ll know your firm and how you like things done.",
  },
];

const STEPS = [
  { lead: "Apply below.", rest: "It takes two minutes." },
  { lead: "We get in touch", rest: "to set up your prices and account." },
  { lead: "Order", rest: "at your trade prices, and pay on invoice." },
];

/**
 * /trade — trade accounts for funeral directors. Reached from the utility
 * bar and the footer. Applying creates nothing: the form emails the
 * business (POST /api/trade) and a person gets back to the firm, so nothing
 * here claims the site prices or invoices trade orders by itself.
 */
export default async function TradePage() {
  const orderTypes = tradeOrderTypes(await getSellableProducts());

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <section className="bg-plum-night text-on-plum">
          <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-center gap-12 py-16 md:py-24">
            <div className="flex flex-col gap-6">
              <p className="eyebrow text-on-plum-muted">For funeral directors</p>
              <h1 className="type-hero text-white">
                A print partner your families never have to <em>worry about.</em>
              </h1>
              <p className="max-w-[32em] text-xl leading-[1.6]">
                Open a trade account for trade prices, payment on invoice and stationery that arrives
                in time for the service, every time.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-2">
                <a href="#apply" className="btn btn-on-dark min-h-14 px-[30px] text-lg">
                  Apply for a trade account
                </a>
                <Link
                  href="/shop"
                  className="text-[17px] font-medium text-white underline underline-offset-4 hover:text-on-plum-muted"
                >
                  See what we print
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-white/15 bg-white/[0.06] p-7 sm:p-8">
              <h2 className="font-display text-2xl font-normal text-white">
                Talk to us about your firm
              </h2>
              <p className="text-base">
                Prefer to chat first? Call and ask for trade. We’ll talk through what you order, how
                quickly you need it and what pricing works for you.
              </p>
              <a
                href={PHONE_HREF}
                className="flex min-h-11 items-center gap-3 self-start text-[26px] font-semibold text-white no-underline hover:underline"
              >
                <Phone size={24} strokeWidth={1.8} aria-hidden />
                {PHONE_DISPLAY}
              </a>
              <p className="text-[15px] text-on-plum-muted/85">
                {OPENING_HOURS} · {ADDRESS_LINES[0]}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-paper">
          <div className="site-container flex flex-col gap-10 py-20 md:py-24">
            <div className="flex max-w-[640px] flex-col gap-3">
              <h2 className="type-section">What a trade account gives you</h2>
              <p className="text-ink-2">
                Built around how funeral directors work: tight deadlines, lots of families, and no
                time to chase a printer.
              </p>
            </div>
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit.title}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-7"
                >
                  <benefit.icon size={26} strokeWidth={1.6} aria-hidden className="mb-2 text-plum" />
                  <h3 className="font-display text-[22px] font-medium text-ink">{benefit.title}</h3>
                  <p className="text-base text-ink-2">{benefit.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-mist">
          <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-start gap-x-16 gap-y-8 py-16 md:py-20">
            <div className="flex flex-col gap-3">
              <p className="eyebrow text-plum">How it works</p>
              <h2 className="type-sub">Set up once, then order whenever a family needs you</h2>
            </div>
            <ol className="flex flex-col gap-5">
              {STEPS.map((step, index) => (
                <li key={step.lead} className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plum text-base font-semibold text-white"
                  >
                    {index + 1}
                  </span>
                  <p className="pt-1">
                    <strong className="font-semibold">{step.lead}</strong> {step.rest}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="apply" className="scroll-mt-6 bg-paper">
          <div className="site-container py-20 md:py-24">
            <div className="mx-auto max-w-[760px]">
              <TradeApplicationForm orderTypes={orderTypes} />
            </div>
          </div>
        </section>
      </main>
      <Footer tradeBand={false} />
    </>
  );
}
