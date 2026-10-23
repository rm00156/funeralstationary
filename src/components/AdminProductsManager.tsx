"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ArrowRight, FileText, GripVertical, Lock, Pencil, Plus, Search, X } from "lucide-react";

import AdminSwitch from "@/components/AdminSwitch";
import type { AdminProduct } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";
import {
  filterProducts,
  groupByOccasion,
  PRODUCT_STATUS_FILTERS,
  PRODUCT_STATUS_LABELS,
  reorderWithinGroup,
  statusCounts,
  suggestSlug,
  type ProductStatusFilter,
} from "@/lib/adminProducts";
import { copiesText, formatPence } from "@/lib/orderOfServicePricing";
import { OCCASION_LABELS, PRODUCT_OCCASIONS, type ProductOccasion } from "@/lib/templates";
import { VAT_TREATMENT_LABELS, VAT_TREATMENTS, type VatTreatment } from "@/lib/vat";

/** A product as the list shows it: the admin row plus its cheapest list price, null until it can be priced. */
export interface AdminProductRow extends AdminProduct {
  from: { pence: number; copies: number } | null;
}

type Drawer = { kind: "new" } | { kind: "edit"; product: AdminProductRow };

const sameOrder = (a: { slug: string }[], b: { slug: string }[]) =>
  a.length === b.length && a.every((item, index) => item.slug === b[index].slug);

export default function AdminProductsManager({ products }: { products: AdminProductRow[] }) {
  const router = useRouter();
  // The list as shown — reordered and switched optimistically, and reset
  // from the server's copy whenever a refresh brings a new one.
  const [items, setItems] = useState(products);
  const [seen, setSeen] = useState(products);
  if (seen !== products) {
    setSeen(products);
    setItems(products);
  }
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProductStatusFilter>("all");
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The row whose handle is held (only then is the row draggable), and the one being dragged.
  const [armed, setArmed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const counts = statusCounts(items);
  const groups = groupByOccasion(filterProducts(items, query, status));
  // A move is a move among the whole group, so it needs the whole group on screen.
  const canReorder = query.trim() === "" && status === "all";

  const saveOrder = async (next: AdminProductRow[]) => {
    if (sameOrder(next, products)) return;
    setError(null);
    const message = await adminMutate("/api/admin/products", "PUT", {
      order: next.map((item) => item.slug),
    });
    if (message) {
      setError(message);
      setItems(products);
    } else {
      router.refresh();
    }
  };

  const reordered = (slug: string, toIndex: number) => {
    const order = reorderWithinGroup(items, slug, toIndex);
    const bySlug = new Map(items.map((item) => [item.slug, item]));
    return order.map((entry) => bySlug.get(entry)!);
  };

  const moveByKey = (event: KeyboardEvent, slug: string, groupIndex: number) => {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = reordered(slug, groupIndex + step);
    if (sameOrder(next, items)) return;
    setItems(next);
    void saveOrder(next);
  };

  const dragOver = (event: DragEvent, target: AdminProductRow, groupIndex: number) => {
    const moving = dragging && items.find((item) => item.slug === dragging);
    if (!moving || moving.occasion !== target.occasion) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (target.slug === dragging) return;
    const next = reordered(dragging, groupIndex);
    if (!sameOrder(next, items)) setItems(next);
  };

  const endDrag = () => {
    setArmed(null);
    setDragging(null);
    void saveOrder(items);
  };

  const toggleActive = async (product: AdminProductRow, isActive: boolean) => {
    setError(null);
    setItems((current) =>
      current.map((item) => (item.slug === product.slug ? { ...item, isActive } : item)),
    );
    const message = await adminMutate(`/api/admin/products/${product.slug}`, "PATCH", { isActive });
    if (message) {
      setError(`${product.label}: ${message}`);
      setItems((current) =>
        current.map((item) =>
          item.slug === product.slug ? { ...item, isActive: !isActive } : item,
        ),
      );
    } else {
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-6 font-body">
      <div className="flex flex-wrap items-center gap-4">
        <label className="relative w-full sm:w-80">
          <span className="sr-only">Search products</span>
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="field min-h-11 py-2 pl-11"
          />
        </label>
        <div role="group" aria-label="Show" className="flex rounded-lg bg-mist-3 p-1">
          {PRODUCT_STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className="min-h-10 rounded-md px-4 font-medium text-ink-2 transition-colors duration-200 hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm"
            >
              {PRODUCT_STATUS_LABELS[value]}
              <span className="ml-2 font-normal text-ink-3">{counts[value]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ kind: "new" })}
          className="btn btn-primary min-h-11 px-5 sm:ml-auto"
        >
          <Plus size={18} aria-hidden />
          Add product
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-block-bg px-4 py-3 text-sm text-block-text">
          {error}
        </p>
      )}

      <div className="table-stack table-stack-wide rounded-xl border border-line bg-surface ambient-shadow">
        <table className="w-full min-w-[960px] text-left">
          <thead>
            <tr className="border-b border-line text-xs font-medium uppercase tracking-[0.18em] text-ink-label">
              <th className="py-4 pl-5 pr-5">
                {/* Spacers the width of the handle and icon, so the heading lines up with the names. */}
                <span className="flex items-center gap-3">
                  <span className="w-8" aria-hidden />
                  <span className="w-10" aria-hidden />
                  <span className="ml-1">Product</span>
                </span>
              </th>
              <th className="px-5 py-4">VAT</th>
              <th className="px-5 py-4">Price from</th>
              <th className="px-5 py-4">Active</th>
              <th className="px-5 py-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink-2">
                  {items.length === 0 ? "No products yet." : "No products match your search."}
                </td>
              </tr>
            )}
            {groups.map((group) => [
              <tr key={`group-${group.occasion}`} className="border-b border-line bg-mist-3">
                <td colSpan={5} className="px-7 py-3 text-sm">
                  <span className="font-medium text-plum">{OCCASION_LABELS[group.occasion]}</span>
                  <span className="ml-3 text-ink-3">
                    {group.products.length} {group.products.length === 1 ? "product" : "products"}
                  </span>
                </td>
              </tr>,
              ...group.products.map((product, groupIndex) => (
                <tr
                  key={product.slug}
                  draggable={armed === product.slug}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", product.slug);
                    setDragging(product.slug);
                  }}
                  onDragOver={(event) => dragOver(event, product, groupIndex)}
                  onDrop={(event) => event.preventDefault()}
                  onDragEnd={endDrag}
                  className={`border-b border-line last:border-b-0 ${
                    dragging === product.slug ? "bg-mist-2 opacity-70" : ""
                  }`}
                >
                  <td data-stack="full" className="max-w-md py-3 pl-5 pr-5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={!canReorder}
                        aria-label={`Move ${product.label} — use the up and down arrow keys`}
                        title={canReorder ? "Drag to reorder" : "Clear the search and show all to reorder"}
                        onPointerDown={() => setArmed(product.slug)}
                        onPointerUp={() => setArmed(null)}
                        onKeyDown={(event) => moveByKey(event, product.slug, groupIndex)}
                        className="flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-3 hover:bg-mist-2 hover:text-ink active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <GripVertical size={18} aria-hidden />
                      </button>
                      <span
                        aria-hidden
                        className="flex h-13 w-10 shrink-0 items-center justify-center rounded-md bg-mist-3 text-plum"
                      >
                        <FileText size={18} />
                      </span>
                      <div className="ml-1 min-w-0">
                        <p
                          className={`text-[17px] font-medium ${product.isActive ? "text-ink" : "text-ink-3"}`}
                        >
                          {product.label}
                        </p>
                        {product.description && (
                          <p className="truncate text-[15px] text-ink-2" title={product.description}>
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td data-label="VAT" className="whitespace-nowrap px-5 py-3 text-ink">
                    {VAT_TREATMENT_LABELS[product.vatTreatment]}
                  </td>
                  <td data-label="Price from" className="whitespace-nowrap px-5 py-3">
                    {product.from ? (
                      <span className="text-ink">
                        {formatPence(product.from.pence)}
                        <span className="text-ink-2"> · {copiesText(product.from.copies)}</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">Not priced yet</span>
                    )}
                  </td>
                  <td data-label="Active" className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <AdminSwitch
                        checked={product.isActive}
                        label={`${product.label} active`}
                        onChange={(next) => void toggleActive(product, next)}
                      />
                      <span aria-hidden className="text-ink-2">
                        {product.isActive ? "On" : "Off"}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${product.slug}`}
                        className="btn btn-outline min-h-11 px-6"
                      >
                        Pricing
                      </Link>
                      <button
                        type="button"
                        aria-label={`Edit ${product.label}`}
                        onClick={() => setDrawer({ kind: "edit", product })}
                        className="btn btn-ghost min-h-11 px-3 text-ink-2"
                      >
                        <Pencil size={18} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-ink-2">
        Drag a row by its handle to change the order customers see. The Active switch saves
        straight away. Use the pencil to edit a product&apos;s name, description, VAT or group. A
        product&apos;s slug is permanent once it&apos;s created.
      </p>

      {drawer && (
        <ProductDrawer
          key={drawer.kind === "edit" ? drawer.product.slug : "new"}
          product={drawer.kind === "edit" ? drawer.product : null}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

const LABEL = "mb-2 block font-medium text-ink";

/**
 * The New / Edit product panel, sliding in from the right. A `<dialog>` with
 * `showModal()`, like ConfirmDialog, so focus is trapped, Escape closes and
 * the list behind is inert.
 */
function ProductDrawer({
  product,
  onClose,
}: {
  /** null: a new product. */
  product: AdminProductRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const [label, setLabel] = useState(product?.label ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState(product?.description ?? "");
  const [occasion, setOccasion] = useState<ProductOccasion>(product?.occasion ?? "service");
  const [vatTreatment, setVatTreatment] = useState<VatTreatment>(product?.vatTreatment ?? "standard");
  const [isActive, setIsActive] = useState(product?.isActive ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    nameRef.current?.focus();
  }, []);

  const dirty =
    product !== null &&
    (label.trim() !== product.label ||
      description.trim() !== (product.description ?? "") ||
      occasion !== product.occasion ||
      vatTreatment !== product.vatTreatment ||
      isActive !== product.isActive);
  const ready = product !== null && product.from !== null && product.publishedTemplateCount > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    if (product) {
      const message = await adminMutate(`/api/admin/products/${product.slug}`, "PATCH", {
        label,
        description,
        occasion,
        vatTreatment,
        isActive,
      });
      setSaving(false);
      if (message) return setError(message);
      onClose();
      router.refresh();
    } else {
      // Created switched off: it has no pricing yet, which is set next.
      const message = await adminMutate("/api/admin/products", "POST", {
        slug,
        label,
        occasion,
        vatTreatment,
        isActive: false,
      });
      if (message) {
        setSaving(false);
        return setError(message);
      }
      router.push(`/admin/products/${slug}`);
    }
  };

  const activeNote = !product
    ? "Off until pricing is set, so customers can't see it yet."
    : !isActive
      ? "Hidden from customers."
      : ready
        ? "Customers can see and order this product."
        : "Customers won't see it until it has a published design and pricing for every option.";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-lg flex-col bg-surface p-0 text-ink shadow-menu backdrop:bg-plum-night/40 open:flex"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col font-body">
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-7 sm:px-8">
          <div>
            <h2 id={`${id}-title`} className="font-display text-3xl text-plum">
              {product ? "Edit product" : "New product"}
            </h2>
            <p className="mt-1 text-ink-2">{product ? product.label : "You'll set its pricing next."}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost -mr-3 min-h-11 px-3"
          >
            <X size={22} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-6">
            <div>
              <label htmlFor={`${id}-name`} className={LABEL}>
                Name
              </label>
              <input
                ref={nameRef}
                id={`${id}-name`}
                value={label}
                maxLength={200}
                onChange={(event) => {
                  setLabel(event.target.value);
                  if (!product && !slugEdited) setSlug(suggestSlug(event.target.value));
                }}
                placeholder={product ? undefined : "Memorial Candles"}
                className="field"
              />
            </div>

            {product && (
              <div>
                <label htmlFor={`${id}-description`} className={LABEL}>
                  Description
                </label>
                <textarea
                  id={`${id}-description`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={300}
                  rows={5}
                  aria-describedby={`${id}-description-hint`}
                  className="field"
                />
                <p id={`${id}-description-hint`} className="mt-2 text-sm text-ink-2">
                  Shown to customers on the shop page.
                </p>
              </div>
            )}

            <div>
              <label htmlFor={`${id}-slug`} className={`${LABEL} flex items-center gap-2`}>
                {product && <Lock size={16} aria-hidden className="text-ink-2" />}
                Slug
              </label>
              <input
                id={`${id}-slug`}
                value={slug}
                readOnly={product !== null}
                maxLength={64}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugEdited(true);
                }}
                placeholder={product ? undefined : "memorial-candles"}
                aria-describedby={`${id}-slug-hint`}
                className={`field ${product ? "border-line bg-mist-3 text-ink-2" : ""}`}
              />
              <p id={`${id}-slug-hint`} className="mt-2 text-sm text-ink-2">
                {product
                  ? "Permanent. It's used in links and order history, so it can't be changed."
                  : "Suggested from the name. Lower-case letters, numbers and hyphens only."}
              </p>
              {!product && (
                <div className="mt-4 flex gap-3 rounded-xl bg-warn-bg p-4 text-ink">
                  <Lock size={18} aria-hidden className="mt-0.5 shrink-0 text-warn-text" />
                  <p>
                    <strong className="font-semibold">The slug is permanent.</strong> It&apos;s
                    used in links and order history, so check it before you create the product. It
                    can&apos;t be changed afterwards.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-occasion`} className={LABEL}>
                  Shop group
                </label>
                <select
                  id={`${id}-occasion`}
                  value={occasion}
                  onChange={(event) => setOccasion(event.target.value as ProductOccasion)}
                  className="field"
                >
                  {PRODUCT_OCCASIONS.map((value) => (
                    <option key={value} value={value}>
                      {OCCASION_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-vat`} className={LABEL}>
                  VAT
                </label>
                <select
                  id={`${id}-vat`}
                  value={vatTreatment}
                  onChange={(event) => setVatTreatment(event.target.value as VatTreatment)}
                  className="field"
                >
                  {VAT_TREATMENTS.map((value) => (
                    <option key={value} value={value}>
                      {VAT_TREATMENT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl bg-mist-2 px-5 py-4">
              <div>
                <p className="font-medium text-ink">Active</p>
                <p className="text-sm text-ink-2">{activeNote}</p>
              </div>
              <AdminSwitch
                checked={isActive}
                disabled={!product}
                label="Active"
                onChange={setIsActive}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-line px-6 py-5 sm:px-8">
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-block-bg px-4 py-3 text-sm text-block-text">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {product && (
              <Link
                href={`/admin/products/${product.slug}`}
                className="link inline-flex min-h-11 items-center gap-2 font-medium"
              >
                Edit pricing
                <ArrowRight size={18} aria-hidden />
              </Link>
            )}
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={onClose} className="btn btn-outline min-h-11 border-line-2 px-6 text-ink">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (product ? !dirty || !label.trim() : !label.trim() || !slug)}
                className="btn btn-primary min-h-11 px-6"
              >
                {product ? (
                  saving ? "Saving…" : "Save changes"
                ) : (
                  <>
                    {saving ? "Creating…" : "Create and set pricing"}
                    <ArrowRight size={18} aria-hidden />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </dialog>
  );
}
