import type { Metadata } from "next";

import TaskFooter from "@/components/TaskFooter";
import TaskHeader from "@/components/TaskHeader";
import UploadFlow, { type UploadProduct } from "@/components/UploadFlow";
import { getSellableProducts } from "@/lib/catalogue.server";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";
import { isStorageConfigured } from "@/lib/storage";
import { getPricingData } from "@/lib/pricing.server";

// The catalogue and its prices are read live, like every shop page.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upload your own design | The Funeral Stationery",
  description:
    "Made it in Canva? Send us a PDF or your Canva link and we’ll print and deliver it. No account needed.",
};

/**
 * "Upload your own design" — the customer's own artwork printed on any
 * sellable product. A focused task, so it wears the slim TaskHeader/
 * TaskFooter rather than the shop's chrome. `?product=` preselects a product.
 */
export default async function UploadPage({ searchParams }: PageProps<"/upload">) {
  const { product: requested } = await searchParams;
  const sellable = await getSellableProducts();
  const products: UploadProduct[] = await Promise.all(
    sellable.map(async (product) => ({
      id: product.id,
      label: product.label,
      format: product.format,
      vatTreatment: product.vatTreatment,
      pricing: await getPricingData(product.id),
    })),
  );

  return (
    <>
      <TaskHeader />
      <main className="type-body flex-1">
        <div className="site-container pb-24 pt-14">
          <div className="mx-auto max-w-[920px]">
            <h1 className="type-page">Upload your own design</h1>
            <p className="mt-4 max-w-[700px] text-[19px] text-ink-2">
              Made it in Canva? Send us a PDF or your Canva link and we’ll print and deliver it. No account
              needed.
            </p>
            {products.length > 0 ? (
              <UploadFlow
                products={products}
                initialProductId={typeof requested === "string" ? requested : undefined}
                uploadsEnabled={isStorageConfigured()}
              />
            ) : (
              <p className="mt-10 rounded-xl border border-line bg-surface p-6">
                We can’t take uploads online just now. Please call us on{" "}
                <a href={PHONE_HREF} className="link">
                  {PHONE_DISPLAY}
                </a>{" "}
                and we’ll help.
              </p>
            )}
          </div>
        </div>
      </main>
      <TaskFooter />
    </>
  );
}
