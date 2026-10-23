"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminProduct } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";

const INPUT = "field min-h-11 py-2 disabled:bg-mist-3 disabled:text-ink-2";
const LABEL = "mb-2 block font-body font-medium text-ink";

const PAGE_STRUCTURES = [
  { value: 3, label: "Booklet — cover, middle (repeats), back" },
  { value: 2, label: "Flat, both sides — front and back" },
  { value: 1, label: "Flat, one side — front only" },
] as const;

/**
 * The product's format: what size it is drawn and printed at, how many pages
 * a template of it authors, and what its options are called. The trim and
 * page structure lock once a template exists, since every layout is
 * percentages of them — the server enforces that too.
 */
export default function AdminProductFormatForm({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const locked = product.templateCount > 0;
  const [sizeLabel, setSizeLabel] = useState(product.sizeLabel);
  const [width, setWidth] = useState(String(product.trimWidthMm));
  const [height, setHeight] = useState(String(product.trimHeightMm));
  const [templatePages, setTemplatePages] = useState(product.templatePages);
  const [sizedByOption, setSizedByOption] = useState(product.sizedByOption);
  const [paperLabel, setPaperLabel] = useState(product.paperLabel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await adminMutate(`/api/admin/products/${product.slug}`, "PATCH", {
      sizeLabel,
      paperLabel,
      sizedByOption,
      // Locked fields are left out rather than resent, so a locked product
      // can still have its labels edited.
      ...(locked
        ? {}
        : { trimWidthMm: Number(width), trimHeightMm: Number(height), templatePages }),
    });
    setSaving(false);
    if (message) setError(message);
    else router.refresh();
  };

  return (
    <form
      onSubmit={save}
      className="rounded-xl border border-line bg-surface px-6 py-6 font-body ambient-shadow sm:px-8"
    >
      <h2 className="mb-2 font-display text-3xl text-plum">Format</h2>
      <p className="mb-6 max-w-2xl text-ink-2">
        {locked
          ? `The trim and page structure are fixed: ${product.templateCount} ${
              product.templateCount === 1 ? "template is" : "templates are"
            } drawn on them. A new format needs a new product.`
          : "Set these before adding templates — they fix once the first template exists."}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        <div>
          <label htmlFor="format-size-label" className={LABEL}>
            Size name
          </label>
          <input
            id="format-size-label"
            value={sizeLabel}
            onChange={(event) => setSizeLabel(event.target.value)}
            placeholder="A6"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="format-width" className={LABEL}>
            Trim width (mm)
          </label>
          <input
            id="format-width"
            type="number"
            min={20}
            max={1500}
            value={width}
            disabled={locked}
            onChange={(event) => setWidth(event.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="format-height" className={LABEL}>
            Trim height (mm)
          </label>
          <input
            id="format-height"
            type="number"
            min={20}
            max={1500}
            value={height}
            disabled={locked}
            onChange={(event) => setHeight(event.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="format-pages" className={LABEL}>
            Template pages
          </label>
          <select
            id="format-pages"
            value={templatePages}
            disabled={locked}
            onChange={(event) => setTemplatePages(Number(event.target.value))}
            className={INPUT}
          >
            {PAGE_STRUCTURES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="format-paper-label" className={LABEL}>
            Paper option name
          </label>
          <input
            id="format-paper-label"
            value={paperLabel}
            onChange={(event) => setPaperLabel(event.target.value)}
            placeholder="Paper"
            className={INPUT}
          />
        </div>
      </div>
      <label className="mt-6 flex max-w-2xl items-start gap-3 rounded-xl bg-mist-2 px-5 py-4 text-ink">
        <input
          type="checkbox"
          checked={sizedByOption}
          onChange={(event) => setSizedByOption(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-plum"
        />
        <span>
          <span className="font-medium">Page-count options are print sizes</span>
          <span className="mt-1 block text-sm text-ink-2">
            For a one-page product sold in several A sizes (a memory board): each page-count option
            is a size with 1 page, and the trim above is the size it is drawn at. Only for sizes that
            share the trim&apos;s shape.
          </span>
        </span>
      </label>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={saving} className="btn btn-primary min-h-11 px-6">
          {saving ? "Saving…" : "Save format"}
        </button>
        {error && (
          <p role="alert" className="rounded-lg bg-block-bg px-4 py-3 text-sm text-block-text">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
