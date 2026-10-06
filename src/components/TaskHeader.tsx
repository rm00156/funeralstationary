import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";

import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

/**
 * The slim header for a page with one job to finish — the upload flow. No
 * shop menu to wander off into: the logo, the phone number for anyone who
 * gets stuck, and a way back to the shop.
 */
export default function TaskHeader() {
  return (
    <header className="site-chrome border-b border-line bg-surface">
      <div className="site-container flex items-center justify-between gap-x-6 py-4">
        <Link href="/" aria-label="The Funeral Stationery – home" className="flex min-w-0">
          <Image
            src="/logo.webp"
            alt="The Funeral Stationery – Bespoke Funeral Stationery"
            width={564}
            height={120}
            priority
            className="h-9 w-auto sm:h-11"
          />
        </Link>
        <div className="flex items-center gap-x-6 text-base">
          <p className="hidden text-ink-2 md:block">
            Need help? Call{" "}
            <a href={PHONE_HREF} className="link font-semibold">
              {PHONE_DISPLAY}
            </a>
          </p>
          <a
            href={PHONE_HREF}
            aria-label={`Call us on ${PHONE_DISPLAY}`}
            className="btn btn-ghost px-3 md:hidden"
          >
            <Phone size={20} aria-hidden />
          </a>
          <Link href="/shop" className="font-medium text-ink hover:text-plum">
            Back to shop
          </Link>
        </div>
      </div>
    </header>
  );
}
