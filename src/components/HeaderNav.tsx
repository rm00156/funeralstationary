"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleUserRound, Menu, Phone, X } from "lucide-react";

import CartLink from "@/components/CartLink";
import SignOutButton from "@/components/SignOutButton";
import {
  DESIGN_FOR_YOU_HREF,
  OPENING_HOURS,
  ORDER_CUTOFF,
  STANDARD_TURNAROUND,
  PHONE_DISPLAY,
  PHONE_HREF,
  UPLOAD_DESIGN_HREF,
} from "@/lib/site";
import {
  OCCASION_LABELS,
  PRODUCT_OCCASIONS,
  type Product,
  type ProductOccasion,
} from "@/lib/templates";

export type NavProduct = Pick<Product, "id" | "label"> & { occasion: ProductOccasion };

/** The two ways to order that aren't catalogue products; on the bar itself, and grouped in the mobile menu. */
const OTHER_WAYS = [
  { label: "Upload your design", href: UPLOAD_DESIGN_HREF },
  { label: "We design it for you", href: DESIGN_FOR_YOU_HREF },
];

/** The rest of the bar after Shop. */
const NAV_LINKS = [...OTHER_WAYS, { label: "Contact", href: "/contact" }];

const productHref = (product: NavProduct) => `/products/${product.id}`;

/** A header menu closes on an outside click or Escape, like a native menu. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref, close]);
}

const GROUP_HEADING = "px-3 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-label";
const MENU_ITEM =
  "block rounded-lg px-3 py-2.5 text-ink no-underline transition-colors hover:bg-mist-2 hover:text-plum";

/**
 * The client half of the header; Header.tsx feeds it the sellable products
 * and the signed-in customer. The utility bar and the header scroll away with
 * the page (nothing here is sticky — the product page's filter bar is).
 *
 * The shop menu is grouped by products.occasion; the two ways to order that
 * aren't catalogue products sit on the bar beside it (and in their own group
 * in the mobile menu). Signed in: "My account" opens a menu with
 * the account page and Sign out. Signed out: "Sign in" goes to /account,
 * which is the sign-in form above whatever this browser has saved.
 */
export default function HeaderNav({
  products,
  user,
  shopClosed,
}: {
  products: NavProduct[];
  user: { email: string } | null;
  /** The site's subscription has lapsed: no designing, uploading or buying online. */
  shopClosed: boolean;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useDismiss(accountOpen, accountRef, () => setAccountOpen(false));
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const shopRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const inShop = pathname.startsWith("/products/") || pathname === "/shop";

  useDismiss(shopOpen, shopRef, () => setShopOpen(false));

  const groups = PRODUCT_OCCASIONS.map((occasion) => ({
    occasion,
    products: products.filter((product) => product.occasion === occasion),
  })).filter((group) => group.products.length > 0);

  const linkClass = (active: boolean) =>
    `flex min-h-11 items-center whitespace-nowrap border-b-2 no-underline transition-colors hover:text-plum ${
      active ? "border-plum text-plum" : "border-transparent text-ink"
    }`;

  return (
    <div className="site-chrome font-body">
      <div className="bg-plum-deep text-[15px] text-on-plum">
        <div className="site-container flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2.5">
          {shopClosed ? (
            <span>
              <strong className="font-semibold text-white">We’re not taking orders online just now.</strong>{" "}
              Please call us and we’ll help.
            </span>
          ) : (
            <span>
              <strong className="font-semibold text-white">{STANDARD_TURNAROUND}</strong> delivery
              if ordered before <strong className="font-semibold text-white">{ORDER_CUTOFF}</strong>{" "}
              on a working day
            </span>
          )}
          <a
            href={PHONE_HREF}
            className="flex min-h-6 items-center gap-2 text-white no-underline hover:underline"
          >
            <Phone size={16} strokeWidth={1.8} aria-hidden />
            {OPENING_HOURS} · {PHONE_DISPLAY}
          </a>
        </div>
      </div>

      <header className="relative border-b border-line bg-surface">
        <div className="site-container flex items-center justify-between gap-x-4 py-4 xl:gap-x-8">
          <Link href="/" aria-label="The Funeral Stationery – home" className="flex min-w-0">
            <Image
              src="/logo.webp"
              alt="The Funeral Stationery – Bespoke Funeral Stationery"
              width={564}
              height={120}
              priority
              className="h-9 w-auto sm:h-11 md:h-14"
            />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-8 text-base font-medium xl:flex">
            <div ref={shopRef} className="relative">
              <button
                type="button"
                onClick={() => setShopOpen((open) => !open)}
                aria-expanded={shopOpen}
                aria-controls="shop-menu"
                className={`cursor-pointer gap-1.5 ${linkClass(inShop)}`}
              >
                Shop
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={`transition-transform ${shopOpen ? "rotate-180" : ""}`}
                />
              </button>
              {shopOpen && (
                <div
                  id="shop-menu"
                  className="absolute -left-6 top-[calc(100%+12px)] z-20 flex w-80 flex-col rounded-xl border border-line bg-surface p-3 font-normal shadow-menu"
                >
                  {groups.map((group, index) => (
                    <div
                      key={group.occasion}
                      className={index > 0 ? "mt-2 border-t border-line pt-3.5" : "pt-2"}
                    >
                      <p className={GROUP_HEADING}>{OCCASION_LABELS[group.occasion]}</p>
                      {group.products.map((product) => (
                        <Link
                          key={product.id}
                          href={productHref(product)}
                          onClick={() => setShopOpen(false)}
                          aria-current={pathname === productHref(product) ? "page" : undefined}
                          className={MENU_ITEM}
                        >
                          {product.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                  <Link
                    href="/shop"
                    onClick={() => setShopOpen(false)}
                    className="mt-2 border-t border-line p-3 font-semibold text-plum no-underline hover:text-plum-deep"
                  >
                    See everything in the shop →
                  </Link>
                </div>
              )}
            </div>

            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={linkClass(pathname === link.href)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user ? (
              <div ref={accountRef} className="relative hidden xl:block">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-expanded={accountOpen}
                  aria-controls="account-menu"
                  className="btn btn-ghost min-h-11 gap-2 px-4 text-base"
                >
                  <CircleUserRound size={18} strokeWidth={1.8} aria-hidden />
                  My account
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className={`transition-transform ${accountOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {accountOpen && (
                  <div
                    id="account-menu"
                    className="absolute right-0 top-[calc(100%+12px)] z-20 w-72 rounded-xl border border-line bg-surface p-3 shadow-menu"
                  >
                    <p className="px-3 pb-3 pt-2 text-[13px] text-ink-3">
                      Signed in as
                      <span className="block truncate text-base font-medium text-ink">
                        {user.email}
                      </span>
                    </p>
                    <Link
                      href="/account"
                      onClick={() => setAccountOpen(false)}
                      className={`border-t border-line ${MENU_ITEM}`}
                    >
                      My designs &amp; orders
                    </Link>
                    <SignOutButton className="min-h-11 w-full rounded-lg px-3 text-base hover:bg-mist-2" />
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/account"
                className="btn btn-ghost hidden min-h-11 gap-2 px-4 text-base xl:inline-flex"
              >
                <CircleUserRound size={18} strokeWidth={1.8} aria-hidden />
                Sign in
              </Link>
            )}
            <CartLink />
            <button
              type="button"
              className="btn btn-ghost min-h-11 px-2.5 text-plum xl:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="flex flex-col border-t border-line bg-surface px-margin-mobile py-4 text-[17px] sm:px-gutter xl:hidden"
          >
            {groups.map((group) => (
              <div key={group.occasion} className="border-b border-line py-2">
                <p className={`pt-2 ${GROUP_HEADING}`}>{OCCASION_LABELS[group.occasion]}</p>
                {group.products.map((product) => (
                  <Link
                    key={product.id}
                    href={productHref(product)}
                    onClick={() => setMenuOpen(false)}
                    aria-current={pathname === productHref(product) ? "page" : undefined}
                    className={MENU_ITEM}
                  >
                    {product.label}
                  </Link>
                ))}
              </div>
            ))}
            <div className="border-b border-line py-2">
              <p className={`pt-2 ${GROUP_HEADING}`}>Other ways to order</p>
              {OTHER_WAYS.map((way) => (
                <Link
                  key={way.href}
                  href={way.href}
                  onClick={() => setMenuOpen(false)}
                  className={MENU_ITEM}
                >
                  {way.label}
                </Link>
              ))}
            </div>
            <div className="py-2 font-medium">
              {[
                { label: "See everything in the shop", href: "/shop" },
                ...NAV_LINKS.filter((link) => !OTHER_WAYS.includes(link)),
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`${MENU_ITEM} ${pathname === link.href ? "text-plum" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/account" onClick={() => setMenuOpen(false)} className={MENU_ITEM}>
                {user ? "My account" : "Sign in"}
              </Link>
            </div>
            {user && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 pt-4">
                <p className="truncate text-[15px] text-ink-3">Signed in as {user.email}</p>
                <SignOutButton className="min-h-11 text-base" />
              </div>
            )}
          </nav>
        )}
      </header>
    </div>
  );
}
