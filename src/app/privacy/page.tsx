import type { Metadata } from "next";
import type { ReactNode } from "react";

import Breadcrumb from "@/components/Breadcrumb";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SITE_COOKIES, cookieLifetimeText } from "@/lib/siteCookies";
import {
  ADDRESS_LINES,
  COMPANY_NAME,
  EMAIL,
  EMAIL_HREF,
  PHONE_DISPLAY,
  PHONE_HREF,
  SITE_NAME,
} from "@/lib/site";

// The header and footer read the live catalogue (and the signed-in customer).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy and cookies | The Funeral Stationery",
  description:
    "What we keep when you design, order or contact us, who helps us make and deliver your order, the cookies the site uses, and your rights.",
};

/** Change this whenever the wording below changes. */
const LAST_UPDATED = "8 October 2026";

const ICO_COMPLAINT_URL = "https://ico.org.uk/make-a-complaint/";
const STRIPE_PRIVACY_URL = "https://stripe.com/gb/privacy";
const GOOGLE_PRIVACY_URL = "https://policies.google.com/privacy";
const TRUSTPILOT_PRIVACY_URL = "https://corporate.trustpilot.com/legal/for-everyone/privacy-policy";

const LIST = "flex list-disc flex-col gap-2.5 pl-6 marker:text-plum";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-6 flex-col gap-4">
      <h2 id={`${id}-heading`} className="font-display text-[30px] leading-[1.2] text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default function PrivacyPage() {
  const contact = (
    <>
      <a href={EMAIL_HREF} className="link [overflow-wrap:anywhere]">
        {EMAIL}
      </a>{" "}
      or call{" "}
      <a href={PHONE_HREF} className="link whitespace-nowrap">
        {PHONE_DISPLAY}
      </a>
    </>
  );

  return (
    <>
      <Header />
      <main className="type-body flex-1">
        <section className="bg-paper">
          <div className="site-container flex flex-col gap-5 pb-12 pt-10 md:pt-14">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Privacy and cookies" }]} />
            <h1 className="type-page">Privacy and cookies</h1>
            <p className="max-w-[36em] text-xl text-ink-2">
              We only ask for what we need to make and deliver your order. This page explains what
              we keep, who helps us, and what you can ask us to do.
            </p>
            <p className="text-base text-ink-3">Last updated {LAST_UPDATED}</p>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="site-container py-16">
            <div className="flex max-w-[760px] flex-col gap-14">
              <div className="flex flex-col gap-4 rounded-xl border border-line-2 bg-paper px-7 py-8">
                <h2 className="font-display text-[26px] leading-[1.2] text-ink">
                  The short version
                </h2>
                <ul className={LIST}>
                  <li>
                    We only use the cookies the site needs to work, so there is nothing to accept or
                    turn off.
                  </li>
                  <li>
                    We use your details to make and deliver your order and to answer your questions.
                    We never sell them.
                  </li>
                  <li>
                    About two weeks after the funeral we send one email asking how we did. You can
                    say no at checkout, or with the link in that email.
                  </li>
                  <li>
                    Card payments are taken by Stripe. We never see or store your card number.
                  </li>
                  <li>
                    You can ask to see, correct or delete what we hold at any time: {contact}.
                  </li>
                </ul>
              </div>

              <Section id="who-we-are" title="Who we are">
                <p>
                  {SITE_NAME} is run by {COMPANY_NAME}, {ADDRESS_LINES.join(", ")}. {COMPANY_NAME}{" "}
                  is responsible for your personal information under UK data protection law (the
                  &ldquo;controller&rdquo;). For anything on this page, email {contact}.
                </p>
              </Section>

              <Section id="cookies" title="Cookies">
                <p>
                  A cookie is a small file a website keeps in your browser. We use only the ones
                  below. Each is needed for something you asked the site to do, such as keeping your
                  basket, so the law doesn&rsquo;t require us to ask first &mdash; which is why you
                  won&rsquo;t see a cookie banner here.
                </p>
                <ul className="flex flex-col gap-3">
                  {SITE_COOKIES.map((cookie) => (
                    <li
                      key={cookie.name}
                      className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper px-6 py-5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                        <code className="font-body text-lg font-semibold text-ink">
                          {cookie.name}
                        </code>
                        <span className="text-base text-ink-3">
                          Kept for {cookieLifetimeText(cookie.seconds)}
                        </span>
                      </div>
                      <p className="text-ink-2">{cookie.purpose}</p>
                    </li>
                  ))}
                </ul>
                <p>
                  <strong className="font-semibold">When you pay,</strong> you move to
                  Stripe&rsquo;s secure checkout page. Stripe sets its own cookies there to take the
                  payment and prevent fraud &mdash; see{" "}
                  <ExternalLink href={STRIPE_PRIVACY_URL}>
                    Stripe&rsquo;s privacy policy
                  </ExternalLink>
                  .
                </p>
                <p>
                  <strong className="font-semibold">To count visits,</strong> we use Vercel Web
                  Analytics. It doesn&rsquo;t use cookies and doesn&rsquo;t identify you: it tells
                  us which pages were viewed, which site you came from, and your country, browser
                  and type of device.
                </p>
                <p>
                  <strong className="font-semibold">Our Trustpilot badge</strong> on the home page
                  is shown by Trustpilot. It sets no cookies, but because it loads from Trustpilot,
                  they see your IP address, the page you&rsquo;re on, and your browser and language
                  &mdash; see{" "}
                  <ExternalLink href={TRUSTPILOT_PRIVACY_URL}>
                    Trustpilot&rsquo;s privacy policy
                  </ExternalLink>
                  .
                </p>
                <p>
                  <strong className="font-semibold">Google reviews</strong> on the home page come
                  from Google Maps. They set no cookies, but the reviewers&rsquo; pictures load from
                  Google, so Google sees your IP address &mdash; see{" "}
                  <ExternalLink href={GOOGLE_PRIVACY_URL}>
                    Google&rsquo;s privacy policy
                  </ExternalLink>
                  .
                </p>
                <p>
                  If we ever add something optional that sets cookies of its own, we&rsquo;ll ask
                  you before it&rsquo;s used.
                </p>
              </Section>

              <Section id="what-we-collect" title="What we collect, and why">
                <ul className={LIST}>
                  <li>
                    <strong className="font-semibold">
                      When you create a design or upload one:
                    </strong>{" "}
                    the wording, the photos you add and any file you upload. We use them to show you
                    a preview and to print your order. Photos often show family and friends; we use
                    them only for your order.
                  </li>
                  <li>
                    <strong className="font-semibold">When you order:</strong> your name, email
                    address, phone number, delivery address, the date of the service if you give it,
                    and what you ordered. We use these to print and deliver your order, to keep you
                    updated about it, and for our accounts. Stripe tells us that you&rsquo;ve paid,
                    never your card details.
                  </li>
                  <li>
                    <strong className="font-semibold">When you sign in:</strong> your email address.
                    We email you a link to sign in with; there is no password.
                  </li>
                  <li>
                    <strong className="font-semibold">When you contact us:</strong> your name, email
                    address, phone number and date of the service if you give them, and your
                    message, so that we can reply.
                  </li>
                  <li>
                    <strong className="font-semibold">After your order:</strong> about two weeks
                    after the funeral (or three weeks after we finish your order, if you
                    didn&rsquo;t give a date) we email you once to ask about your experience, with a
                    link to leave a review on Google if you&rsquo;d like to. We don&rsquo;t send it
                    if you unticked the box at checkout, if you&rsquo;ve asked us to stop, or if
                    your order was cancelled or refunded. The email has a link to stop them for
                    good.
                  </li>
                  <li>
                    <strong className="font-semibold">When you visit:</strong> the company that
                    hosts our website records technical details such as your IP address, to keep the
                    site running and secure.
                  </li>
                </ul>
                <p>
                  The law asks us to say why we&rsquo;re allowed to use this information. For your
                  order, it&rsquo;s because we need it to carry out our contract with you. For our
                  accounts, it&rsquo;s because the law requires us to keep sales records. For
                  replying to messages, keeping the site secure, counting visits and asking how we
                  did, it&rsquo;s our legitimate interest in running the business, which we keep to
                  the minimum.
                </p>
              </Section>

              <Section id="who-helps-us" title="Who helps us">
                <p>These companies handle information for us, only to do the job listed:</p>
                <ul className={LIST}>
                  <li>
                    <strong className="font-semibold">Stripe</strong> takes card payments.
                  </li>
                  <li>
                    <strong className="font-semibold">Thintent</strong> is the order system our
                    print room works from. It receives your order, contact details and delivery
                    address.
                  </li>
                  <li>
                    <strong className="font-semibold">Resend</strong> sends our emails: order
                    confirmations, sign-in links, the email asking how we did and messages from our
                    contact form.
                  </li>
                  <li>
                    <strong className="font-semibold">Amazon Web Services</strong> stores your
                    photos, uploaded files and print files.
                  </li>
                  <li>
                    <strong className="font-semibold">Vercel</strong> hosts the website.
                  </li>
                  <li>
                    <strong className="font-semibold">TiDB Cloud</strong> (PingCAP) holds our
                    database of designs and orders.
                  </li>
                  <li>
                    <strong className="font-semibold">The courier</strong> delivering your order
                    receives the name and address on the parcel.
                  </li>
                </ul>
                <p>
                  We don&rsquo;t share your information with anyone else unless the law requires us
                  to.
                </p>
              </Section>

              <Section id="where-it-is-kept" title="Where it’s kept">
                <p>
                  Our website, database and files are kept in Frankfurt, Germany. The UK recognises
                  the EU as protecting personal information to the same standard. Some of the
                  companies above are based in the United States and may handle information there;
                  when they do, it&rsquo;s protected by the safeguards UK law requires, such as the
                  UK International Data Transfer Addendum.
                </p>
              </Section>

              <Section id="how-long" title="How long we keep it">
                <ul className={LIST}>
                  <li>
                    <strong className="font-semibold">Orders</strong> are kept for six years,
                    because UK tax law requires us to keep records of what we sell.
                  </li>
                  <li>
                    <strong className="font-semibold">Designs, photos and uploaded files</strong>{" "}
                    are kept so that you can come back to them or order more copies. You can remove
                    a design from your account, or ask us to delete your designs and photos
                    completely.
                  </li>
                  <li>
                    <strong className="font-semibold">Messages</strong> are kept for as long as we
                    need them to help you, and with your order if they&rsquo;re about one.
                  </li>
                  <li>
                    <strong className="font-semibold">Sign-in links</strong> stop working after 15
                    minutes, or as soon as they&rsquo;re used.
                  </li>
                </ul>
              </Section>

              <Section id="your-rights" title="Your rights">
                <p>You can ask us to:</p>
                <ul className={LIST}>
                  <li>tell you what we hold about you and give you a copy</li>
                  <li>correct anything that&rsquo;s wrong</li>
                  <li>delete it, unless the law requires us to keep it</li>
                  <li>stop or limit how we use it</li>
                  <li>send it to you, or to someone else, in a format a computer can read</li>
                </ul>
                <p>
                  To ask, email {contact}. We&rsquo;ll reply within one month. If you&rsquo;re
                  unhappy with how we&rsquo;ve handled your information, please tell us first so
                  that we can put it right. You can also complain to the Information
                  Commissioner&rsquo;s Office at{" "}
                  <ExternalLink href={ICO_COMPLAINT_URL}>ico.org.uk</ExternalLink> or on{" "}
                  <span className="whitespace-nowrap">0303 123 1113</span>.
                </p>
              </Section>

              <Section id="changes" title="Changes to this page">
                <p>
                  If we change how we use your information, we&rsquo;ll update this page and the
                  date at the top.
                </p>
              </Section>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
