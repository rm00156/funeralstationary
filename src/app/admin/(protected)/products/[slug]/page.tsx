import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import AdminOptionTable from "@/components/AdminOptionTable";
import {
  adminGetProduct,
  adminListOptions,
  OPTION_KINDS,
  type OptionKind,
} from "@/lib/adminCatalogue.server";

export const dynamic = "force-dynamic";

const KIND_TITLES: Record<OptionKind, string> = {
  quantity: "Quantities",
  size: "Sizes",
  colour: "Colour options",
  "page-count": "Page counts",
  paper: "Paper stocks",
  delivery: "Delivery options",
};

/** Display order — mirrors the order the customer configurator asks in. */
const KIND_ORDER: OptionKind[] = [
  "quantity",
  "size",
  "colour",
  "page-count",
  "paper",
  "delivery",
];

export default async function AdminProductPricingPage({
  params,
}: PageProps<"/admin/products/[slug]">) {
  const { slug } = await params;
  const product = await adminGetProduct(slug);
  if (!product) notFound();

  const optionsByKind = new Map(
    await Promise.all(
      OPTION_KINDS.map(async (kind) => [kind, await adminListOptions(slug, kind)] as const),
    ),
  );

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

      <h1 className="mb-2 font-display text-3xl font-semibold text-primary">
        {product.label}
      </h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        Prices are entered in pounds and stored to the penny. A quote multiplies
        the page-count base rate by the size, colour, paper and quantity
        multipliers, then adds delivery.
      </p>

      <div className="flex flex-col gap-8">
        {KIND_ORDER.map((kind) => (
          <AdminOptionTable
            key={kind}
            productSlug={slug}
            kind={kind}
            title={KIND_TITLES[kind]}
            options={optionsByKind.get(kind) ?? []}
          />
        ))}
      </div>
    </>
  );
}
