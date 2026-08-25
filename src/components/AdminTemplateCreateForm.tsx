"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import type { AdminProduct } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";

const fieldInput =
  "rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body text-sm focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15";

export default function AdminTemplateCreateForm({
  products,
}: {
  products: AdminProduct[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [productId, setProductId] = useState(products[0]?.slug ?? "");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await adminMutate("/api/admin/templates", "POST", {
      slug,
      name,
      productId,
      previewImageUrl,
      status: "draft",
    });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    router.push(`/admin/templates/${slug}`);
    router.refresh();
  };

  return (
    <form
      onSubmit={create}
      className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow"
    >
      <h2 className="mb-1 font-display text-lg text-primary">New template</h2>
      <p className="mb-4 font-body text-sm text-on-surface-variant">
        Templates start as drafts — customers only see them once published.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="new-template-name"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Name
          </label>
          <input
            id="new-template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Autumn Leaves"
            className={`${fieldInput} w-52`}
          />
        </div>
        <div>
          <label
            htmlFor="new-template-slug"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Slug (permanent)
          </label>
          <input
            id="new-template-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="autumn-leaves"
            className={`${fieldInput} w-52`}
          />
        </div>
        <div>
          <label
            htmlFor="new-template-product"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Product
          </label>
          <select
            id="new-template-product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className={`${fieldInput} w-52`}
          >
            {products.map((product) => (
              <option key={product.slug} value={product.slug}>
                {product.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="new-template-image"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Preview image URL
          </label>
          <input
            id="new-template-image"
            value={previewImageUrl}
            onChange={(event) => setPreviewImageUrl(event.target.value)}
            placeholder="https://…"
            className={`${fieldInput} w-72`}
          />
        </div>
        <button
          type="submit"
          disabled={saving || !slug || !name || !productId || !previewImageUrl}
          className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-40"
        >
          <Plus size={16} aria-hidden />
          {saving ? "Creating…" : "Create template"}
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
