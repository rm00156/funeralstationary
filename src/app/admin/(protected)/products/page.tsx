import AdminProductsManager from "@/components/AdminProductsManager";
import { adminListProducts } from "@/lib/adminCatalogue.server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await adminListProducts();

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-semibold text-primary">Products</h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        The product range customers can browse. Open a product&apos;s pricing to
        edit the options and rates behind its live quote.
      </p>
      <AdminProductsManager products={products} />
    </>
  );
}
