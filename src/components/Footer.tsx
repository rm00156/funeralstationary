import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getSellableProducts } from "@/lib/catalogue.server";
import { getCurrentTradeMembership } from "@/lib/trade.server";
import { authConfigured } from "@/lib/userSession";
import {
  ADDRESS_LINES,
  COMPANY_NAME,
  DESIGN_FOR_YOU_HREF,
  EMAIL,
  EMAIL_HREF,
  OPENING_HOURS,
  PHONE_DISPLAY,
  PHONE_HREF,
  SITE_NAME,
  TRADE_HREF,
  UPLOAD_DESIGN_HREF,
} from "@/lib/site";

const LINK = "text-on-plum-muted no-underline hover:text-white hover:underline";
const HEADING = "mb-1 font-display text-xl font-medium text-white";

/**
 * The site footer. A server component for the same reason as Header: the Shop
 * column is the live list of sellable products (React-cached, so a page pays
 * for the query once), never a hardcoded set of links.
 *
 * Above the columns, a light band (so it stands apart from the dark footer)
 * points funeral directors to trade accounts; /trade itself turns it off,
 * and it isn't shown to someone signed in on a trade account.
 */
export default async function Footer({ tradeBand = true }: { tradeBand?: boolean } = {}) {
  const [products, membership] = await Promise.all([
    getSellableProducts(),
    authConfigured() ? getCurrentTradeMembership() : null,
  ]);
  // Someone already on a trade account doesn't need to be sold one.
  const showTradeBand = tradeBand && !membership;

  return (
    <footer className="site-chrome mt-auto bg-plum-night font-body text-base text-on-plum-muted">
      {showTradeBand && (
        <div className="border-t border-line-2 bg-mist text-ink-2">
          <div className="site-container flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-8">
            <p className="max-w-[44em]">
              <strong className="font-display text-[22px] font-medium text-plum-deep">
                Ordering for families?
              </strong>{" "}
              Funeral directors can open a trade account for trade prices and payment on invoice.
            </p>
            <Link href={TRADE_HREF} className="btn btn-primary min-h-12 shrink-0">
              Trade accounts
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
      )}
      <div className="site-container flex flex-col gap-12 pb-10 pt-[72px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-10">
          <div className="flex flex-col gap-4">
            <div className="self-start rounded-lg bg-white px-3.5 py-2.5">
              <Image
                src="/logo.webp"
                alt={SITE_NAME}
                width={564}
                height={120}
                className="h-10 w-auto"
              />
            </div>
            <p>Compassionate professionalism for your most precious tributes.</p>
          </div>

          <nav aria-label="Shop" className="flex flex-col gap-3">
            <h2 className={HEADING}>Shop</h2>
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`} className={LINK}>
                {product.label}
              </Link>
            ))}
            <Link href={DESIGN_FOR_YOU_HREF} className={LINK}>
              We design it for you
            </Link>
            <Link href={UPLOAD_DESIGN_HREF} className={LINK}>
              Upload your own design
            </Link>
          </nav>

          <nav aria-label="Help" className="flex flex-col gap-3">
            <h2 className={HEADING}>Help</h2>
            <Link href="/shop" className={LINK}>
              Shop
            </Link>
            <Link href="/contact" className={LINK}>
              Contact
            </Link>
            <Link href="/account" className={LINK}>
              My designs &amp; orders
            </Link>
            <Link href={TRADE_HREF} className="font-semibold text-white no-underline hover:underline">
              For funeral directors
            </Link>
          </nav>

          <div className="flex flex-col gap-3">
            <h2 className={HEADING}>Get in touch</h2>
            <a href={PHONE_HREF} className={LINK}>
              {PHONE_DISPLAY}
            </a>
            <a href={EMAIL_HREF} className={`${LINK} [overflow-wrap:anywhere]`}>
              {EMAIL}
            </a>
            <address className="mt-2 not-italic leading-[1.6]">
              {OPENING_HOURS}
              <br />
              {ADDRESS_LINES[0]}
              <br />
              {ADDRESS_LINES[1]}
            </address>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-x-8 gap-y-3 border-t border-white/20 pt-6 text-sm text-on-plum-muted/85">
          <span>
            &copy; {SITE_NAME} · {COMPANY_NAME}
          </span>
          <Link href="/privacy" className={LINK}>
            Privacy and cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}
