import AdminProductsManager from "@/components/AdminProductsManager";
import { adminListProducts } from "@/lib/adminCatalogue.server";
import { cheapestQuote } from "@/lib/orderOfServicePricing";
import { getListPricingData } from "@/lib/pricing.server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await adminListProducts();
  // The same cheapest configuration the shop's "from £X" shows, at list price.
  const rows = await Promise.all(
    products.map(async (product) => {
      const quote = cheapestQuote(await getListPricingData(product.slug));
      return {
        ...product,
        from: quote ? { pence: quote.totalPence, copies: quote.quantity.value } : null,
      };
    }),
  );

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">Products</h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        The product range customers can browse. Open a product&apos;s pricing to
        edit the options and rates behind its live quote.
      </p>
      <AdminProductsManager products={rows} />
    </>
  );
}
