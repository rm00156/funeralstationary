"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

/**
 * Header basket link with a line count. The count comes from GET /api/cart
 * (read-only — it never mints a guest cookie) on mount and again whenever
 * something dispatches the `tfs:cart-changed` window event.
 */
export default function CartLink({
  className = "",
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        const { cart } = (await response.json()) as { cart: { items: unknown[] } | null };
        if (!cancelled) setCount(cart?.items.length ?? 0);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    void load();
    window.addEventListener("tfs:cart-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("tfs:cart-changed", load);
    };
  }, []);

  return (
    <Link
      href="/cart"
      onClick={onClick}
      aria-label={count ? `Basket, ${count} ${count === 1 ? "item" : "items"}` : "Basket"}
      className={`btn btn-outline min-h-11 gap-2 px-3 text-base sm:px-4 ${className}`}
    >
      <ShoppingBag size={18} strokeWidth={1.8} aria-hidden />
      {/* The word gives way to the icon on the narrowest phones; the label above still says it. */}
      <span className="max-[420px]:sr-only">Basket</span>
      {count !== null && `(${count})`}
    </Link>
  );
}
