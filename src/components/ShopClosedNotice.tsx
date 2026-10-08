import Link from "next/link";
import { Phone } from "lucide-react";

import { EMAIL, EMAIL_HREF, OPENING_HOURS, PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

/**
 * Shown in place of the editor, the upload flow, the basket and checkout
 * while the site's subscription is unpaid (see src/lib/siteAccess.ts).
 * The designs stay browsable; this sends the customer to a person instead.
 */
export default function ShopClosedNotice({ title = "We’re not taking orders online just now" }: { title?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
      <h2 className="type-sub">{title}</h2>
      <p className="mt-3 max-w-[640px] text-ink-2">
        You can still look through our designs. To order, please call or email us and we’ll help you
        put your stationery together.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={PHONE_HREF} className="btn btn-primary">
          <Phone size={18} strokeWidth={1.8} aria-hidden />
          Call {PHONE_DISPLAY}
        </a>
        <a href={EMAIL_HREF} className="btn btn-outline">
          Email {EMAIL}
        </a>
        <Link href="/shop" className="btn btn-ghost">
          Browse designs
        </Link>
      </div>
      <p className="mt-4 text-base text-ink-3">Lines are open {OPENING_HOURS}.</p>
    </div>
  );
}
