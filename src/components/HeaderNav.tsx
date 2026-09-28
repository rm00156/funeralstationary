"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleUserRound, LogIn, Menu, X } from "lucide-react";

import CartLink from "@/components/CartLink";
import SignOutButton from "@/components/SignOutButton";
import type { Product } from "@/lib/templates";

const NAV_LINKS = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Contact", href: "/#contact" },
];

const productHref = (product: Product) => `/products/${product.id}`;

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

/**
 * The client half of the header; Header.tsx feeds it the sellable products
 * and the signed-in customer. Signed in: "My Account" opens a menu with the
 * account page and Sign out. Signed out: "Sign in" goes to /account, which
 * is the sign-in form above whatever this browser has saved.
 */
export default function HeaderNav({
  products,
  user,
}: {
  products: Product[];
  user: { email: string } | null;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useDismiss(accountOpen, accountRef, () => setAccountOpen(false));
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const shopRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const inShop = pathname.startsWith("/products/") || pathname === "/templates";

  useDismiss(shopOpen, shopRef, () => setShopOpen(false));

  const linkClass = (active: boolean) =>
    active
      ? "text-primary font-bold border-b-2 border-primary pb-1"
      : "text-on-surface-variant hover:text-primary-container transition-colors duration-300";

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-outline-variant shadow-sm">
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-gutter max-w-[1200px] mx-auto h-20">
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/logo.webp"
            alt="The Funeral Stationery"
            width={564}
            height={120}
            priority
            className="h-10 md:h-14 w-auto object-contain group-hover:opacity-90 transition-opacity"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <div ref={shopRef} className="relative">
            <button
              type="button"
              onClick={() => setShopOpen((open) => !open)}
              aria-expanded={shopOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-1 cursor-pointer ${linkClass(inShop)}`}
            >
              Shop
              <ChevronDown
                size={16}
                aria-hidden
                className={`transition-transform duration-300 ${shopOpen ? "rotate-180" : ""}`}
              />
            </button>
            {shopOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-3 min-w-56 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2 ambient-shadow"
              >
                {products.map((product) => (
                  <Link
                    key={product.id}
                    role="menuitem"
                    href={productHref(product)}
                    onClick={() => setShopOpen(false)}
                    className={`block rounded-lg px-3.5 py-2.5 font-body text-sm transition-colors hover:bg-surface-container-low hover:text-primary ${
                      pathname === productHref(product)
                        ? "font-semibold text-primary"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {product.label}
                  </Link>
                ))}
                <Link
                  role="menuitem"
                  href="/templates"
                  onClick={() => setShopOpen(false)}
                  className={`mt-1 block rounded-lg border-t border-outline-variant/40 px-3.5 py-2.5 pt-3 font-body text-sm transition-colors hover:bg-surface-container-low hover:text-primary ${
                    pathname === "/templates" ? "font-semibold text-primary" : "text-on-surface-variant"
                  }`}
                >
                  All templates
                </Link>
              </div>
            )}
          </div>

          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className={linkClass(link.href === pathname)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <CartLink className="hidden md:flex" />
          {user ? (
            <div ref={accountRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-container text-white rounded-lg hover:bg-primary transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                <CircleUserRound size={18} aria-hidden />
                My Account
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={`transition-transform duration-300 ${accountOpen ? "rotate-180" : ""}`}
                />
              </button>
              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-3 min-w-64 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2 ambient-shadow"
                >
                  <p className="truncate px-3.5 pt-2 pb-3 font-body text-xs text-on-surface-variant">
                    Signed in as
                    <span className="block truncate text-sm font-medium text-on-surface">
                      {user.email}
                    </span>
                  </p>
                  <Link
                    role="menuitem"
                    href="/account"
                    onClick={() => setAccountOpen(false)}
                    className="block rounded-lg border-t border-outline-variant/40 px-3.5 py-2.5 font-body text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                  >
                    My designs &amp; orders
                  </Link>
                  <SignOutButton className="w-full rounded-lg px-3.5 py-2.5 hover:bg-surface-container-low" />
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/account"
              className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-primary-container text-white rounded-lg hover:bg-primary transition-colors duration-300 text-sm font-medium tracking-wide"
            >
              <LogIn size={18} aria-hidden />
              Sign in
            </Link>
          )}
          <button
            className="md:hidden text-primary p-2"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-outline-variant bg-background px-margin-mobile py-4 flex flex-col gap-4">
          <p className="font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
            Shop
          </p>
          {products.map((product) => (
            <Link
              key={product.id}
              href={productHref(product)}
              onClick={() => setMenuOpen(false)}
              className={
                pathname === productHref(product)
                  ? "text-primary font-bold"
                  : "text-on-surface-variant hover:text-primary transition-colors"
              }
            >
              {product.label}
            </Link>
          ))}
          <Link
            href="/templates"
            onClick={() => setMenuOpen(false)}
            className={
              pathname === "/templates"
                ? "text-primary font-bold"
                : "text-on-surface-variant hover:text-primary transition-colors"
            }
          >
            All templates
          </Link>
          <span className="h-px bg-outline-variant/40" aria-hidden />
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={
                link.href === pathname
                  ? "text-primary font-bold"
                  : "text-on-surface-variant hover:text-primary transition-colors"
              }
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <CartLink className="flex" onClick={() => setMenuOpen(false)} />
          <Link
            href="/account"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-container text-white rounded-lg hover:bg-primary transition-colors duration-300 text-sm font-medium tracking-wide"
          >
            {user ? <CircleUserRound size={18} aria-hidden /> : <LogIn size={18} aria-hidden />}
            {user ? "My Account" : "Sign in"}
          </Link>
          {user && (
            <div className="flex flex-col items-center gap-1">
              <p className="font-body text-xs text-on-surface-variant">Signed in as {user.email}</p>
              <SignOutButton />
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
