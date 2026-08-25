"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CircleUserRound, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Order of Service", href: "/order-of-service" },
  { label: "Themes", href: "/#templates" },
  { label: "Pricing", href: "/#pricing" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Contact", href: "/#contact" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={
                link.href === pathname
                  ? "text-primary font-bold border-b-2 border-primary pb-1"
                  : "text-on-surface-variant hover:text-primary-container transition-colors duration-300"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-primary-container text-white rounded-lg hover:bg-primary transition-colors duration-300 text-sm font-medium tracking-wide">
            <CircleUserRound size={18} />
            My Account
          </button>
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
          <button className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-container text-white rounded-lg hover:bg-primary transition-colors duration-300 text-sm font-medium tracking-wide">
            <CircleUserRound size={18} />
            My Account
          </button>
        </nav>
      )}
    </header>
  );
}
