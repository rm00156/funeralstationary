import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { paymentFeePence } from "@/lib/stripe.server";

function intent(latestCharge: unknown): Stripe.PaymentIntent {
  return { id: "pi_1", latest_charge: latestCharge } as unknown as Stripe.PaymentIntent;
}

describe("paymentFeePence", () => {
  it("reads the fee off the charge's balance transaction", () => {
    expect(paymentFeePence(intent({ balance_transaction: { currency: "gbp", fee: 118 } }))).toBe(118);
  });

  it("is null while the payment has no charge, or the charge no balance transaction yet", () => {
    expect(paymentFeePence(intent(null))).toBeNull();
    expect(paymentFeePence(intent({ balance_transaction: null }))).toBeNull();
  });

  it("is null when the charge or its transaction wasn't expanded", () => {
    expect(paymentFeePence(intent("ch_1"))).toBeNull();
    expect(paymentFeePence(intent({ balance_transaction: "txn_1" }))).toBeNull();
  });

  it("is null for a fee settled in another currency", () => {
    expect(paymentFeePence(intent({ balance_transaction: { currency: "eur", fee: 118 } }))).toBeNull();
  });
});
