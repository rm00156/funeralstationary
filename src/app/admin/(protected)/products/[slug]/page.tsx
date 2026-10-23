import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import AdminPricingEditor from "@/components/AdminPricingEditor";
import {
  adminGetProduct,
  adminListOptions,
  OPTION_KINDS,
  type AdminOption,
  type OptionKind,
} from "@/lib/adminCatalogue.server";

export const dynamic = "force-dynamic";

export default async function AdminProductPricingPage({
  params,
}: PageProps<"/admin/products/[slug]">) {
  const { slug } = await params;
  const product = await adminGetProduct(slug);
  if (!product) notFound();

  const options = Object.fromEntries(
    await Promise.all(
      OPTION_KINDS.map(async (kind) => [kind, (await adminListOptions(slug, kind)) ?? []] as const),
    ),
  ) as Record<OptionKind, AdminOption[]>;

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 font-body text-sm text-on-surface-variant"
      >
        <Link href="/admin/products" className="transition-colors hover:text-primary">
          Products
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-on-surface">{product.label}</span>
      </nav>

      <h1 className="mb-2 font-display text-3xl font-medium text-primary">
        {product.label}
      </h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        Prices are entered in pounds and stored to the penny. A quote multiplies
        the page-count base rate by the paper, size and quantity
        multipliers, then adds delivery.
      </p>

      <AdminPricingEditor product={product} options={options} />
    </>
  );
}
