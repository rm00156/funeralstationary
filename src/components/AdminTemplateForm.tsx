"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, X } from "lucide-react";

import type { AdminCategory, AdminProduct, AdminTemplate } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";

const fieldInput =
  "rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body text-sm focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15";

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
    >
      {children}
    </label>
  );
}

export default function AdminTemplateForm({
  template,
  products,
  categories,
}: {
  template: AdminTemplate;
  products: AdminProduct[];
  categories: AdminCategory[];
}) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [productId, setProductId] = useState(template.productSlug);
  const [status, setStatus] = useState(template.status);
  const [sortOrder, setSortOrder] = useState(String(template.sortOrder));
  const [previewImageUrl, setPreviewImageUrl] = useState(template.previewImageUrl);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    template.categories,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableCategories = categories.filter(
    (category) => !selectedCategories.includes(category.slug),
  );

  const moveCategory = (index: number, direction: -1 | 1) => {
    setSelectedCategories((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  /** Same presigned-PUT flow the editor's photo picker uses. */
  const uploadPreview = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const reserve = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, byteSize: file.size }),
      });
      if (!reserve.ok) {
        const { error: message } = (await reserve.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(message ?? "Could not start the upload");
      }
      const { uploadUrl, url } = (await reserve.json()) as {
        uploadUrl: string;
        url: string;
      };
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Could not upload the image");
      setPreviewImageUrl(url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Could not upload the image",
      );
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await adminMutate(`/api/admin/templates/${template.slug}`, "PATCH", {
      name,
      productId,
      status,
      sortOrder: Number(sortOrder),
      previewImageUrl,
      categories: selectedCategories,
    });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
    router.refresh();
  };

  return (
    <form
      onSubmit={save}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:items-start"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadPreview(file);
          event.target.value = "";
        }}
      />

      {/* preview image */}
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 ambient-shadow">
        <div className="relative mb-3 aspect-3/4 w-full overflow-hidden rounded-lg bg-surface-container-low">
          {previewImageUrl && (
            <Image
              src={previewImageUrl}
              alt={`${name} preview`}
              fill
              sizes="280px"
              className="object-contain p-3"
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-variant px-4 py-2.5 font-body text-sm font-medium text-on-surface-variant transition-colors duration-300 hover:border-primary-container hover:text-primary disabled:opacity-60"
        >
          <ImagePlus size={16} aria-hidden />
          {uploading ? "Uploading…" : "Upload preview image"}
        </button>
        <FieldLabel htmlFor="template-image-url">Or paste an image URL</FieldLabel>
        <input
          id="template-image-url"
          value={previewImageUrl}
          onChange={(event) => setPreviewImageUrl(event.target.value)}
          className={`${fieldInput} w-full`}
        />
      </div>

      {/* metadata */}
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 ambient-shadow">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="template-name">Name</FieldLabel>
            <input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={`${fieldInput} w-full`}
            />
          </div>
          <div>
            <FieldLabel htmlFor="template-slug">
              Slug (permanent — used in links and order history)
            </FieldLabel>
            <input
              id="template-slug"
              value={template.slug}
              readOnly
              className={`${fieldInput} w-full cursor-not-allowed text-on-surface-variant`}
            />
          </div>
          <div>
            <FieldLabel htmlFor="template-product">Product</FieldLabel>
            <select
              id="template-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className={`${fieldInput} w-full`}
            >
              {products.map((product) => (
                <option key={product.slug} value={product.slug}>
                  {product.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="template-status">Status</FieldLabel>
              <select
                id="template-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as AdminTemplate["status"])
                }
                className={`${fieldInput} w-full`}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="template-sort">Sort</FieldLabel>
              <input
                id="template-sort"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className={`${fieldInput} w-full`}
              />
            </div>
          </div>
        </div>

        {/* ordered categories — first category drives the starter accent */}
        <div className="mt-6">
          <FieldLabel htmlFor="template-add-category">
            Categories (first one sets the starter accent colour)
          </FieldLabel>
          <ul className="mb-3 flex flex-col gap-2">
            {selectedCategories.map((slug, index) => {
              const category = categories.find((entry) => entry.slug === slug);
              return (
                <li
                  key={slug}
                  className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface"
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-outline-variant/40"
                    style={{ backgroundColor: category?.accentHex ?? "#1f1a1e" }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {category?.label ?? slug}
                  </span>
                  <button
                    type="button"
                    aria-label={`Move ${category?.label ?? slug} up`}
                    disabled={index === 0}
                    onClick={() => moveCategory(index, -1)}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
                  >
                    <ArrowUp size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${category?.label ?? slug} down`}
                    disabled={index === selectedCategories.length - 1}
                    onClick={() => moveCategory(index, 1)}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
                  >
                    <ArrowDown size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${category?.label ?? slug}`}
                    onClick={() =>
                      setSelectedCategories((current) =>
                        current.filter((entry) => entry !== slug),
                      )
                    }
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </li>
              );
            })}
            {selectedCategories.length === 0 && (
              <li className="font-body text-sm text-on-surface-variant">
                No categories yet.
              </li>
            )}
          </ul>
          {availableCategories.length > 0 && (
            <select
              id="template-add-category"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  setSelectedCategories((current) => [...current, event.target.value]);
                }
              }}
              className={`${fieldInput} w-full sm:w-72`}
            >
              <option value="">Add a category…</option>
              {availableCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 font-body text-sm text-primary">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-lg bg-primary-container px-6 py-2.5 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
          {savedFlash && (
            <span aria-live="polite" className="font-body text-sm text-secondary">
              Saved
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
