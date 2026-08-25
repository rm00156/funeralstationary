"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import type { AdminCategory } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";

const cellInput =
  "rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body text-sm focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15";

export default function AdminCategoriesManager({
  categories,
}: {
  categories: AdminCategory[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Slug</th>
              <th className="px-5 py-3">Accent</th>
              <th className="px-5 py-3">Sort</th>
              <th className="px-5 py-3">Active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <CategoryRow key={category.slug} category={category} />
            ))}
          </tbody>
        </table>
      </div>
      <CreateCategoryForm />
    </div>
  );
}

function CategoryRow({ category }: { category: AdminCategory }) {
  const router = useRouter();
  const [label, setLabel] = useState(category.label);
  const [accentHex, setAccentHex] = useState(category.accentHex);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [isActive, setIsActive] = useState(category.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const message = await adminMutate(`/api/admin/categories/${category.slug}`, "PATCH", {
      label,
      accentHex,
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
          aria-label={`Label for ${category.slug}`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className={`${cellInput} w-full min-w-40`}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-primary">
            {error}
          </p>
        )}
      </td>
      <td className="px-5 py-3 text-on-surface-variant">{category.slug}</td>
      <td className="px-5 py-3">
        <input
          aria-label={`Accent colour for ${category.slug}`}
          type="color"
          value={accentHex}
          onChange={(event) => setAccentHex(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-outline-variant/60 bg-surface-container-lowest"
        />
      </td>
      <td className="px-5 py-3">
        <input
          aria-label={`Sort order for ${category.slug}`}
          type="number"
          min={0}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          className={`${cellInput} w-16`}
        />
      </td>
      <td className="px-5 py-3">
        <input
          aria-label={`${category.slug} active`}
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 accent-primary-container"
        />
      </td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary-container px-4 py-2 font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

function CreateCategoryForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [accentHex, setAccentHex] = useState("#1f1a1e");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await adminMutate("/api/admin/categories", "POST", {
      slug,
      label,
      accentHex,
    });
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
      <h2 className="mb-4 font-display text-lg text-primary">New category</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="new-category-label"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Label
          </label>
          <input
            id="new-category-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Butterflies"
            className={`${cellInput} w-56`}
          />
        </div>
        <div>
          <label
            htmlFor="new-category-slug"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Slug (permanent)
          </label>
          <input
            id="new-category-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="butterflies"
            className={`${cellInput} w-56`}
          />
        </div>
        <div>
          <label
            htmlFor="new-category-accent"
            className="mb-2 block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary"
          >
            Accent
          </label>
          <input
            id="new-category-accent"
            type="color"
            value={accentHex}
            onChange={(event) => setAccentHex(event.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-outline-variant/60 bg-surface-container-lowest"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !slug || !label}
          className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-primary disabled:opacity-40"
        >
          <Plus size={16} aria-hidden />
          {saving ? "Creating…" : "Create category"}
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
