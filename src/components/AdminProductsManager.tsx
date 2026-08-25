"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import type { AdminProduct } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";

export default function AdminProductsManager({ products }: { products: AdminProduct[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Slug</th>
              <th className="px-5 py-3">Sort</th>
              <th className="px-5 py-3">Active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ProductRow key={product.slug} product={product} />
            ))}
          </tbody>
        </table>
      </div>
      <CreateProductForm />
    </div>
  );
}

function ProductRow({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [label, setLabel] = useState(product.label);
  const [sortOrder, setSortOrder] = useState(String(product.sortOrder));
  const [isActive, setIsActive] = useState(product.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    label !== product.label ||
    Number(sortOrder) !== product.sortOrder ||
    isActive !== product.isActive;

  const save = async () => {
    setSaving(true);
    setError(null);
    const message = await adminMutate(`/api/admin/products/${product.slug}`, "PATCH", {
      label,
      sortOrder: Number(sortOrder),
      isActive,
    });
    setSaving(false);
    if (message) setError(message);
    else router.refresh();
  };

  return (
    <tr className="border-b border-outline-variant/20 font-body text-sm text-on-surface last:border-b-0">
      <td className="px-5 py-3">
        <input
          aria-label={`Label for ${product.slug}`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="w-full min-w-44 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-primary">
            {error}
          </p>
        )}
      </td>
      <td className="px-5 py-3 text-on-surface-variant">{product.slug}</td>
      <td className="px-5 py-3">
        <input
          aria-label={`Sort order for ${product.slug}`}
          type="number"
          min={0}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          className="w-20 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
        />
      </td>
      <td className="px-5 py-3">
        <input
          aria-label={`${product.slug} active`}
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 accent-primary-container"
        />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-primary-container px-4 py-2 font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            href={`/admin/products/${product.slug}`}
            className="rounded-lg border-2 border-primary-container px-4 py-1.5 font-medium text-primary-container transition-colors duration-300 hover:bg-surface-container"
          >
            Pricing
          </Link>
        </div>
      </td>
    </tr>
  );
}

function CreateProductForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await adminMutate("/api/admin/products", "POST", { slug, label });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setSlug("");
    setLabel("");
    router.refresh();
  };

  return (
    <form
      onSubmit={create}
      className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow"
    >
      <h2 className="mb-4 font-display text-lg text-primary">New product</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="new-product-label"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Label
          </label>
          <input
            id="new-product-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Memorial Candles"
            className="w-64 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body text-sm focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
          />
        </div>
        <div>
          <label
            htmlFor="new-product-slug"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Slug (permanent — used in links and order history)
          </label>
          <input
            id="new-product-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="memorial-candles"
            className="w-64 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body text-sm focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !slug || !label}
          className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-40"
        >
          <Plus size={16} aria-hidden />
          {saving ? "Creating…" : "Create product"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-primary">
          {error}
        </p>
      )}
    </form>
  );
}
