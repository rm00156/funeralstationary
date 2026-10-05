import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getSellableProducts } from "@/lib/catalogue.server";
import { CONTACT_TOPICS, DEFAULT_CONTACT_TOPIC } from "@/lib/contact";
import {
  ADDRESS_LINES,
  COMPANY_NAME,
  EMAIL,
  EMAIL_HREF,
  OPENING_HOURS_LONG,
  PHONE_DISPLAY,
  PHONE_HREF,
} from "@/lib/site";

// The topic list, header and footer read the live catalogue.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact | The Funeral Stationery",
  description: `Questions about a design, the wording or whether we can make your date? Call ${PHONE_DISPLAY}, ${OPENING_HOURS_LONG}, or send us a message.`,
};

const MAP_QUERY = encodeURIComponent(`${COMPANY_NAME}, ${ADDRESS_LINES.join(", ")}`);

const CARD = "flex gap-[18px] rounded-xl border border-line bg-surface p-7";
const CARD_HEADING = "font-display text-[22px] font-medium text-ink";

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const [{ topic: topicParam }, products] = await Promise.all([
    searchParams,
    getSellableProducts(),
  ]);
  const topics = [
    ...products.map(({ id, label }) => ({ id, label })),
    ...CONTACT_TOPICS.map(({ id, label }) => ({ id, label })),
  ];
  // ?topic= comes from the "design it for me" / "upload" / "ask for a price"
  // links; anything the select doesn't offer falls back to the default.
  const initialTopic =
    topics.find((topic) => topic.id === topicParam)?.id ?? DEFAULT_CONTACT_TOPIC;

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <section className="bg-paper">
          <div className="site-container flex flex-col gap-5 pb-10 pt-10 md:pt-14">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
            <h1 className="type-page">We’re here to help</h1>
            <p className="max-w-[36em] text-xl text-ink-2">
              Questions about a design, the wording or whether we can make your date? Talk to a
              real person, {OPENING_HOURS_LONG}.
            </p>
            <div className="mt-3 flex max-w-[880px] flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-line-2 bg-surface px-6 py-5">
              <Clock size={26} strokeWidth={1.8} aria-hidden className="shrink-0 text-plum" />
              <p className="flex-[1_1_400px] text-[17px]">
                <strong className="font-semibold">Is the funeral in the next few days?</strong>{" "}
                Please call us on{" "}
                <a href={PHONE_HREF} className="link font-semibold">
                  {PHONE_DISPLAY}
                </a>{" "}
                so we can confirm timings with you straight away.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-paper">
          <div className="site-container flex flex-wrap items-start gap-12 pb-24 pt-6">
            <div className="flex flex-[1_1_340px] flex-col gap-4">
              <div className={CARD}>
                <Phone size={28} strokeWidth={1.6} aria-hidden className="shrink-0 text-plum" />
                <div className="flex flex-col gap-1">
                  <h2 className={CARD_HEADING}>Call us</h2>
                  <a
                    href={PHONE_HREF}
                    className="text-[22px] font-semibold text-plum no-underline hover:underline"
                  >
                    {PHONE_DISPLAY}
                  </a>
                  <p className="text-base text-ink-2">{OPENING_HOURS_LONG}</p>
                </div>
              </div>
              <div className={CARD}>
                <Mail size={28} strokeWidth={1.6} aria-hidden className="shrink-0 text-plum" />
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className={CARD_HEADING}>Email us</h2>
                  <a href={EMAIL_HREF} className="link text-[17px] font-semibold [overflow-wrap:anywhere]">
                    {EMAIL}
                  </a>
                  <p className="text-base text-ink-2">Urgent request? Say so in the subject line.</p>
                </div>
              </div>
              <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
                <div className="flex gap-[18px] p-7">
                  <MapPin size={28} strokeWidth={1.6} aria-hidden className="shrink-0 text-plum" />
                  <div className="flex flex-col gap-1">
                    <h2 className={CARD_HEADING}>Visit us, by appointment</h2>
                    <address className="text-base not-italic text-ink-2">
                      {COMPANY_NAME}, {ADDRESS_LINES[0]}
                      <br />
                      {ADDRESS_LINES[1]}
                    </address>
                    <p className="mt-1 text-base text-ink-2">
                      Please call ahead to book a time before popping in.
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link flex min-h-11 items-center text-base font-medium"
                    >
                      Open in Google Maps
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </div>
                </div>
                <iframe
                  title={`Map showing ${COMPANY_NAME}, ${ADDRESS_LINES.join(", ")}`}
                  src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-[220px] w-full border-0 bg-mist-2"
                />
              </div>
            </div>

            <div className="flex-[1.4_1_480px]">
              <ContactForm topics={topics} initialTopic={initialTopic} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
