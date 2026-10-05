"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ShoppingBag, Trash2 } from "lucide-react";

import ConfigField from "@/components/ConfigField";
import { PAGE_SIZE_LABEL } from "@/lib/designEditor";
import { formatPence, type PricingData } from "@/lib/orderOfServicePricing";
import type { Cart, CartItem } from "@/lib/orders.server";
import type { SelectionAxis } from "@/lib/orders";

/** Tell the header badge (and anything else listening) the basket changed. */
export const notifyCartChanged = () => window.dispatchEvent(new Event("tfs:cart-changed"));

type LineAxis = "quantity" | "delivery";

const AXIS_LABELS: Record<LineAxis, string> = {
  quantity: "Copies",
  delivery: "Delivery",
};

export default function CartView({
  initialCart,
  pricingByProduct,
}: {
  initialCart: Cart | null;
  /** Option lists keyed by product slug, for every product in the basket. */
  pricingByProduct: Record<string, PricingData>;
}) {
  const [cart, setCart] = useState<Cart | null>(initialCart);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (key: string, url: string, method: "PATCH" | "DELETE", body?: unknown) => {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { cart?: Cart; error?: string };
      if (!response.ok) throw new Error(payload.error || "Something went wrong — please try again");
      setCart(payload.cart ?? null);
      notifyCartChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong — please try again");
    } finally {
      setBusy(null);
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-10 text-center">
        <ShoppingBag size={28} className="mx-auto mb-4 text-on-surface-variant" aria-hidden />
        <p className="mb-6 font-body text-base text-on-surface-variant">Your basket is empty.</p>
        <Link
          href="/shop"
          className="inline-flex items-center rounded-lg bg-plum px-5 py-3 font-body text-sm font-medium text-white transition-colors hover:bg-plum-hover"
        >
          Browse designs
        </Link>
      </div>
    );
  }

  const { totals } = cart;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        {error && (
          <p role="alert" className="mb-4 font-body text-sm text-primary">
            {error}
          </p>
        )}
        <ul className="flex flex-col gap-4">
          {cart.items.map((item) => (
            <CartLine
              key={item.id}
              item={item}
              pricing={pricingByProduct[item.productId] ?? null}
              busy={busy === item.id}
              onChange={(axis, value) =>
                mutate(item.id, `/api/cart/items/${item.id}`, "PATCH", { [axis]: value })
              }
              onRemove={() => mutate(item.id, `/api/cart/items/${item.id}`, "DELETE")}
            />
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-surface-container-lowest p-6 ambient-shadow lg:sticky lg:top-28">
        <h2 className="mb-5 font-display text-2xl text-primary">Summary</h2>

        <dl className="space-y-3 font-body text-on-surface-variant">
          <div className="flex justify-between gap-4">
            <dt>Subtotal</dt>
            <dd className="text-on-surface">{formatPence(totals.subtotalPence)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Delivery</dt>
            <dd className="text-on-surface">
              {totals.deliveryPence === 0 ? "Free" : formatPence(totals.deliveryPence)}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-outline-variant/40 pt-5">
          <span className="font-display text-xl text-on-surface">Total</span>
          <span aria-live="polite" className="font-display text-3xl font-medium text-primary">
            {formatPence(totals.totalPence)}
          </span>
        </div>
        <p className="mt-1 text-right font-body text-sm text-on-surface-variant">
          Includes VAT of {formatPence(totals.vatPence)}
        </p>

        {cart.ready ? (
          <Link
            href="/checkout"
            className="mt-6 block rounded-lg bg-primary-container px-6 py-3.5 text-center font-body text-base font-medium tracking-wide text-white transition-colors duration-300 hover:bg-primary"
          >
            Checkout
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="mt-6 block w-full rounded-lg bg-primary-container px-6 py-3.5 text-center font-body text-base font-medium tracking-wide text-white opacity-40"
            >
              Checkout
            </button>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Resolve the highlighted items to continue.
            </p>
          </>
        )}
        <p className="mt-4 font-body text-sm text-on-surface-variant">
          Each item is delivered on the option you choose for it.
        </p>
      </aside>
    </div>
  );
}

function CartLine({
  item,
  pricing,
  busy,
  onChange,
  onRemove,
}: {
  item: CartItem;
  pricing: PricingData | null;
  busy: boolean;
  onChange: (axis: LineAxis, value: string) => void;
  onRemove: () => void;
}) {
  const problem = item.designMissing
    ? "This design has been removed — please take it out of your basket."
    : item.stale.length > 0
      ? `The ${item.stale.map(axisLabel).join(", ")} you chose ${item.stale.length > 1 ? "are" : "is"} no longer available — please choose again.`
      : null;

  return (
    <li
      className={`rounded-2xl border bg-surface-container-lowest p-5 ${
        problem ? "border-primary/40" : "border-outline-variant/60"
      }`}
    >
      <div className="flex gap-5">
        <span className="relative block h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-container-low">
          {item.templateImage && (
            <Image src={item.templateImage} alt="" fill sizes="80px" className="object-contain p-1" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-medium text-on-surface">
                {item.designName}
              </h2>
              <p className="font-body text-sm text-on-surface-variant">
                {item.productLabel} · {item.templateName}
              </p>
              <p className="font-body text-sm text-on-surface-variant">
                {PAGE_SIZE_LABEL} · {item.pageCount} pages
                {item.quote ? ` · ${item.quote.paper.label} paper` : ""}
                {item.designId && (
                  <>
                    {" · "}
                    <Link href={`/design?design=${item.designId}`} className="underline hover:text-primary">
                      Edit design
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl text-primary">
                {item.quote ? formatPence(item.lineTotalPence) : "—"}
              </p>
              {item.quote && (
                <p className="font-body text-xs text-on-surface-variant">
                  {formatPence(item.unitPricePence)} each
                </p>
              )}
            </div>
          </div>

          {problem && (
            <p role="alert" className="mt-3 flex items-start gap-2 font-body text-sm text-primary">
              <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
              {problem}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(["quantity", "delivery"] as const).map((axis) => {
          const stale = item.stale.includes(axis);
          // Copies are listed as "15 copies" so the number can't be read as a page count.
          const options =
            axis === "quantity"
              ? (pricing?.quantity ?? []).map((option) => ({ id: option.id, label: `${option.value} copies` }))
              : pricing?.delivery ?? [];
          return (
            <ConfigField
              key={axis}
              id={`${item.id}-${axis}`}
              label={AXIS_LABELS[axis]}
              value={stale ? "" : item.selection[axis]}
              disabled={busy || item.designMissing}
              options={stale ? [{ id: "", label: "Choose…" }, ...options] : options}
              onChange={(value) => value && onChange(axis, value)}
              note={
                axis === "delivery" && item.delivery
                  ? `${item.delivery.pricePence === 0 ? "Free" : formatPence(item.delivery.pricePence)} · ${
                      item.deliveryOptions.find((option) => option.id === item.delivery?.optionId)?.note ?? ""
                    }`
                  : undefined
              }
            />
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg px-3 py-2 font-body text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-50"
        >
          <Trash2 size={16} aria-hidden />
          Remove
        </button>
      </div>
    </li>
  );
}

function axisLabel(axis: SelectionAxis): string {
  return axis in AXIS_LABELS ? AXIS_LABELS[axis as LineAxis].toLowerCase() : axis;
}
