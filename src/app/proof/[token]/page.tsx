import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { ARTBOARD_H_MM, ARTBOARD_W_MM } from "@/lib/designEditor";
import { getSharedProof } from "@/lib/orders.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared proof | The Funeral Stationery",
  robots: { index: false, follow: false },
};

const PAGE_ASPECT = ARTBOARD_W_MM / ARTBOARD_H_MM;

/**
 * A proof as forwarded to family — artwork only, and read-only.
 *
 * Unauthenticated by design: the whole point is that it survives being
 * emailed to a sibling, which an owner-scoped /orders link does not. It
 * therefore shows nothing but the pages: no price, no address, no delivery
 * details, and no way to approve. Approval stays with whoever placed the
 * order, and the link can be revoked from their order page.
 */
export default async function SharedProofPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedProof(token);
  if (!shared) notFound();

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-surface px-margin-mobile pt-12 pb-section-gap md:px-gutter">
          <div className="mx-auto max-w-[900px]">
            <h1 className="font-display text-4xl font-semibold leading-tight text-primary md:text-5xl">
              Shared proof
            </h1>
            <p className="mt-3 max-w-2xl font-body text-lg text-on-surface-variant">
              Someone has shared the proof for order {shared.orderNumber} with you for a
              second pair of eyes. Please look carefully at names, dates and spellings.
            </p>
            <p className="mt-2 max-w-2xl font-body text-sm text-on-surface-variant">
              Only the person who placed the order can approve it — let them know if you
              spot anything.
            </p>

            {shared.items.map((item) => (
              <section key={item.id} className="mt-10">
                <h2 className="font-display text-2xl text-primary">{item.designName}</h2>
                <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3">
                  {item.pages.map((page) => (
                    <li key={page.pageIndex} className="flex flex-col gap-1.5">
                      <div
                        className="relative overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-lowest ambient-shadow"
                        style={{ aspectRatio: PAGE_ASPECT }}
                      >
                        <Image
                          src={page.imageUrl}
                          alt={`Page ${page.pageIndex + 1}`}
                          fill
                          sizes="(max-width: 640px) 45vw, 280px"
                          className="object-contain"
                        />
                      </div>
                      <span className="text-center font-body text-xs text-on-surface-variant">
                        Page {page.pageIndex + 1}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
