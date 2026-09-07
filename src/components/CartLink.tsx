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
      className={`items-center justify-center gap-2 rounded-lg border-2 border-primary-container px-5 py-2 text-sm font-medium tracking-wide text-primary-container transition-colors duration-300 hover:bg-surface-container ${className}`}
    >
      <ShoppingBag size={18} aria-hidden />
      Basket
      {!!count && (
        <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary-container px-1.5 text-xs text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
