import type { Metadata } from "next";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { readReviewOptOutToken } from "@/lib/reviewRequest";
import { EMAIL, EMAIL_HREF } from "@/lib/site";
import { authSecret } from "@/lib/userSession";

// The header and footer read the live catalogue (and the signed-in customer).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email preferences | The Funeral Stationery",
  robots: { index: false, follow: false },
};

/**
 * Where "Stop emails like this one" in a review request lands. Opening it
 * changes nothing — mail scanners open every link — the button does, with a
 * plain form post that needs no script.
 */
export default async function UnsubscribePage({ searchParams }: PageProps<"/email/unsubscribe">) {
  const { t, done } = await searchParams;
  const token = typeof t === "string" ? t : null;
  const secret = authSecret();
  const email = token && secret ? readReviewOptOutToken(token, secret) : null;

  return (
    <>
      <Header />
      <main className="type-body flex-1 bg-paper">
        <div className="site-container flex max-w-[680px] flex-col gap-5 py-16 md:py-20">
          {!email || !token ? (
            <>
              <h1 className="type-sub">This link isn’t valid</h1>
              <p className="text-ink-2">
                It may have been copied incompletely. To stop our emails, write to{" "}
                <a href={EMAIL_HREF} className="link">
                  {EMAIL}
                </a>{" "}
                and we’ll take care of it.
              </p>
            </>
          ) : done === "1" ? (
            <>
              <h1 className="type-sub">You won’t hear from us again about reviews</h1>
              <p className="text-ink-2">
                We won’t send emails asking about your experience to{" "}
                <strong className="font-semibold text-ink">{email}</strong>. You’ll still get
                confirmations and updates for any order you place.
              </p>
            </>
          ) : (
            <>
              <h1 className="type-sub">Stop emails asking how we did?</h1>
              <p className="text-ink-2">
                After an order we send one email asking about your experience. Press the button and
                we won’t send any more to{" "}
                <strong className="font-semibold text-ink">{email}</strong>. You’ll still get
                confirmations and updates for any order you place.
              </p>
              <form method="post" action={`/api/email/unsubscribe?t=${encodeURIComponent(token)}`}>
                <button type="submit" className="btn btn-primary min-h-14 px-7 text-lg">
                  Stop these emails
                </button>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
