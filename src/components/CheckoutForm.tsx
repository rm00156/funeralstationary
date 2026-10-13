"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock } from "lucide-react";

import type { CheckoutDetails } from "@/lib/checkoutValidation";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import type { Cart } from "@/lib/orders.server";
import { lineSpec } from "@/lib/orders";
import { vatIncludedText } from "@/lib/vat";

const fieldInput =
  "w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 font-body text-base text-on-surface focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

type FormState = {
  [K in keyof CheckoutDetails | "serviceDate" | "familyName" | "customerRef"]: string;
};

export default function CheckoutForm({
  cart,
  cancelled,
  paymentsConfigured,
  accountEmail = null,
  tradeFirmName = null,
  account = null,
}: {
  cart: Cart;
  /** The customer backed out of Stripe Checkout. */
  cancelled: boolean;
  paymentsConfigured: boolean;
  /** The signed-in customer's email, used only to prefill the contact field. */
  accountEmail?: string | null;
  /** The signed-in account's firm (trade.ts): the form then asks for the family and a reference. */
  tradeFirmName?: string | null;
  /** Set when that firm may order on account: the form offers it, as the default. */
  account?: { paymentTermsDays: number; invoicesTo: string | null } | null;
}) {
  const [payWith, setPayWith] = useState<"account" | "card">(account ? "account" : "card");
  const onAccount = account !== null && payWith === "account";
  const [form, setForm] = useState<FormState>({
    contactName: cart.details?.contactName ?? "",
    contactEmail: cart.details?.contactEmail ?? accountEmail ?? "",
    contactPhone: cart.details?.contactPhone ?? "",
    addressLine1: cart.details?.addressLine1 ?? "",
    addressLine2: cart.details?.addressLine2 ?? "",
    city: cart.details?.city ?? "",
    postcode: cart.details?.postcode ?? "",
    serviceDate: cart.serviceDate ?? "",
    familyName: cart.trade?.familyName ?? "",
    customerRef: cart.trade?.customerRef ?? "",
  });
  // The review request (reviewRequest.ts). Ticked by default; unticking it is the
  // customer's way to say no, which is all the soft opt-in asks for.
  const [reviewEmail, setReviewEmail] = useState(!(cart.reviewOptOut ?? false));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(onAccount ? "/api/checkout/account" : "/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          serviceDate: form.serviceDate || null,
          reviewOptOut: !reviewEmail,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Something went wrong — please try again");
      }
      // Card: Stripe's page. On account: the order is placed, so its own page.
      window.location.assign(payload.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong — please try again");
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        {cancelled && (
          <p className="rounded-xl bg-surface-container-low px-5 py-4 font-body text-sm text-on-surface-variant">
            Your payment was not taken. Your basket is unchanged — you can try again
            whenever you are ready.
          </p>
        )}
        {!paymentsConfigured && !onAccount && (
          <p role="alert" className="rounded-xl bg-surface-container-low px-5 py-4 font-body text-sm text-primary">
            Online payments are not configured yet — please contact us to complete your order.
          </p>
        )}

        <section className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-8">
          <h2 className="mb-6 font-display text-2xl text-primary">Your details</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="contactName" label="Full name">
                <input id="contactName" autoComplete="name" required value={form.contactName} onChange={set("contactName")} className={fieldInput} />
              </Field>
            </div>
            <Field id="contactEmail" label="Email">
              <input id="contactEmail" type="email" autoComplete="email" required value={form.contactEmail} onChange={set("contactEmail")} className={fieldInput} />
            </Field>
            <Field id="contactPhone" label="Phone (optional)">
              <input id="contactPhone" type="tel" autoComplete="tel" value={form.contactPhone} onChange={set("contactPhone")} className={fieldInput} />
            </Field>
          </div>
          <p className="mt-4 font-body text-sm text-on-surface-variant">
            We will send your order confirmation to this email address.
          </p>
        </section>

        {tradeFirmName && (
          <section className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-8">
            <h2 className="mb-2 font-display text-2xl text-primary">The family</h2>
            <p className="mb-6 font-body text-sm text-on-surface-variant">
              Ordering for {tradeFirmName}. This is how you&rsquo;ll find the order in your account.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="familyName" label="Family name">
                <input id="familyName" required placeholder="e.g. Harper family" value={form.familyName} onChange={set("familyName")} className={fieldInput} />
              </Field>
              <Field id="customerRef" label="Your reference (optional)">
                <input id="customerRef" maxLength={60} placeholder="e.g. your case or job number" value={form.customerRef} onChange={set("customerRef")} className={fieldInput} />
              </Field>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-8">
          <h2 className="mb-6 font-display text-2xl text-primary">The service</h2>
          <Field id="serviceDate" label="Date of the funeral (optional)">
            <input
              id="serviceDate"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={form.serviceDate}
              onChange={set("serviceDate")}
              aria-describedby="serviceDate-help"
              className={`${fieldInput} sm:max-w-[320px]`}
            />
          </Field>
          <p id="serviceDate-help" className="mt-4 font-body text-sm text-on-surface-variant">
            Helps us make sure your order arrives in time.
          </p>
        </section>

        <section className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-8">
          <h2 className="mb-6 font-display text-2xl text-primary">Delivery address</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="addressLine1" label="Address line 1">
                <input id="addressLine1" autoComplete="address-line1" required value={form.addressLine1} onChange={set("addressLine1")} className={fieldInput} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="addressLine2" label="Address line 2 (optional)">
                <input id="addressLine2" autoComplete="address-line2" value={form.addressLine2} onChange={set("addressLine2")} className={fieldInput} />
              </Field>
            </div>
            <Field id="city" label="Town or city">
              <input id="city" autoComplete="address-level2" required value={form.city} onChange={set("city")} className={fieldInput} />
            </Field>
            <Field id="postcode" label="Postcode">
              <input id="postcode" autoComplete="postal-code" required value={form.postcode} onChange={set("postcode")} className={fieldInput} />
            </Field>
          </div>
          <p className="mt-4 font-body text-sm text-on-surface-variant">
            We deliver within the United Kingdom.
          </p>
        </section>

        {account && (
          <section className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-8">
            <h2 className="mb-6 font-display text-2xl text-primary">How to pay</h2>
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">How to pay</legend>
              {[
                {
                  value: "account" as const,
                  title: "On account",
                  body: `No card now. We’ll invoice ${account.invoicesTo ?? "you"}, and payment is due ${account.paymentTermsDays} days after the invoice.`,
                },
                { value: "card" as const, title: "Pay now by card", body: "Pay securely with Stripe before the order goes to print." },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer gap-3 rounded-xl border-[1.5px] border-line-2 p-4 has-checked:border-plum has-checked:bg-mist-2"
                >
                  <input
                    type="radio"
                    name="payWith"
                    value={option.value}
                    checked={payWith === option.value}
                    onChange={() => setPayWith(option.value)}
                    className="mt-1 size-4 shrink-0 accent-plum"
                  />
                  <span className="font-body">
                    <span className="block font-medium text-on-surface">{option.title}</span>
                    <span className="block text-sm text-on-surface-variant">{option.body}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>
        )}

        {error && (
          <p role="alert" className="font-body text-sm text-primary">
            {error}
          </p>
        )}

        <label className="-mb-3 flex min-h-11 cursor-pointer items-center gap-2.5 self-start font-body text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={reviewEmail}
            onChange={(event) => setReviewEmail(event.target.checked)}
            className="size-4 shrink-0 accent-plum"
          />
          Email me once after the funeral to ask how we did
        </label>

        <button
          type="submit"
          disabled={submitting || !cart.ready || (!onAccount && !paymentsConfigured)}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-container px-8 py-4 font-body text-base font-medium tracking-wide text-white shadow-lg shadow-primary-container/30 transition-colors duration-300 hover:bg-primary disabled:opacity-50 disabled:shadow-none"
        >
          {onAccount ? (
            submitting ? "Placing your order…" : `Place order on account · ${formatPence(cart.totals.totalPence)}`
          ) : (
            <>
              <Lock size={16} aria-hidden />
              {submitting ? "Taking you to payment…" : `Pay ${formatPence(cart.totals.totalPence)} securely`}
            </>
          )}
        </button>
        <p className="-mt-4 text-center font-body text-xs text-on-surface-variant">
          {onAccount
            ? "It goes to print straight away. The invoice comes from us by email."
            : "Card payments are handled by Stripe. We never see your card details."}
        </p>
      </form>

      <aside className="h-fit rounded-2xl border border-line bg-surface-container-lowest p-6 ambient-shadow lg:sticky lg:top-28">
        <h2 className="mb-5 font-display text-2xl text-primary">Your order</h2>
        <ul className="divide-y divide-outline-variant/40 font-body text-sm">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3">
              <div>
                <p className="font-medium text-on-surface">{item.designName}</p>
                <p className="text-on-surface-variant">
                  {copiesText(item.quantityCopies)}
                  {item.quote ? ` · ${lineSpec(item.format, item.quote)}` : ""}
                </p>
                {item.delivery && (
                  <p className="text-on-surface-variant">
                    {item.delivery.label} ·{" "}
                    {item.delivery.pricePence === 0 ? "Free" : formatPence(item.delivery.pricePence)}
                  </p>
                )}
              </div>
              <span className="whitespace-nowrap text-on-surface">{formatPence(item.lineTotalPence)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-outline-variant/40 pt-4 font-body text-sm text-on-surface-variant">
          <div className="flex justify-between gap-4">
            <dt>Subtotal</dt>
            <dd className="text-on-surface">{formatPence(cart.totals.subtotalPence)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Delivery</dt>
            <dd className="text-on-surface">
              {cart.totals.deliveryPence === 0 ? "Free" : formatPence(cart.totals.deliveryPence)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-outline-variant/40 pt-4">
          <span className="font-display text-xl text-on-surface">Total</span>
          <span className="font-display text-3xl font-medium text-primary">
            {formatPence(cart.totals.totalPence)}
          </span>
        </div>
        <p className="mt-1 text-right font-body text-sm text-on-surface-variant">
          {vatIncludedText(cart.totals.vatPence)}
        </p>
        <Link href="/cart" className="mt-5 block text-center font-body text-sm text-on-surface-variant underline hover:text-primary">
          Change quantities or delivery
        </Link>
      </aside>
    </div>
  );
}
