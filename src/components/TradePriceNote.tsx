import { BadgePercent } from "lucide-react";

import { tradeDiscountText } from "@/lib/trade";
import { getCurrentTradeMembership } from "@/lib/trade.server";

/**
 * "Trade prices for Hollis & Daughters: 10% off print, already included" —
 * beside any prices a trade customer sees. The prices themselves are already
 * discounted where they're loaded (pricing.server.ts); this only says so.
 * Renders nothing for anyone without a discount.
 */
export default async function TradePriceNote({ className = "" }: { className?: string }) {
  const membership = await getCurrentTradeMembership();
  if (!membership || !(membership.discountPercent > 0)) return null;
  return (
    <p
      className={`flex items-start gap-2.5 rounded-lg bg-mist-2 px-4 py-3 text-base text-ink ${className}`}
    >
      <BadgePercent size={20} strokeWidth={1.7} aria-hidden className="mt-0.5 shrink-0 text-plum" />
      <span>
        Trade prices for <strong className="font-semibold">{membership.firmName}</strong>:{" "}
        {tradeDiscountText(membership.discountPercent)} print, already included. Delivery is full price.
      </span>
    </p>
  );
}
