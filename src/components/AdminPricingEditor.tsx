"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { GripVertical, Plus } from "lucide-react";

import AdminProductFormatForm from "@/components/AdminProductFormatForm";
import AdminSwitch from "@/components/AdminSwitch";
import type { AdminOption, AdminProduct, OptionKind } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";
import {
  changedKeys,
  changeSummary,
  editsPatch,
  isUnchanged,
  KIND_AXIS,
  KIND_FIELDS,
  moveItem,
  newOptionPayload,
  previewPricingData,
  pricingSections,
  pruneEdits,
  savedValue,
  type EditKey,
  type FieldKey,
  type OptionEdits,
  type PricingSection,
} from "@/lib/adminPricing";
import { suggestSlug } from "@/lib/adminProducts";
import {
  copiesText,
  formatPence,
  getQuote,
  type PricingData,
  type Selection,
} from "@/lib/orderOfServicePricing";
import { CUTOFF_TOKEN, ORDER_CUTOFF } from "@/lib/site";

type Tab = "format" | OptionKind;
type EditsByKind = Record<OptionKind, Record<string, OptionEdits>>;

const NO_EDITS: EditsByKind = { quantity: {}, "page-count": {}, paper: {}, delivery: {}, size: {} };

const SECTION_NOTES: Partial<Record<OptionKind, ReactNode>> = {
  delivery: (
    <>
      Write <code>{CUTOFF_TOKEN}</code> in a note wherever the order cut-off goes — it shows as{" "}
      {ORDER_CUTOFF}, the same time as everywhere else on the site.
    </>
  ),
  size: (
    <>
      Designs are drawn once, at this product’s own size, and scaled to the size ordered — so every
      size must be the same shape (A6, A5 and A4 all are). With one active size, customers
      aren’t asked.
    </>
  ),
};

/**
 * A product's pricing page: its format and its option tables, one at a
 * time, with a live quote beside them. Typed values are held as edits over
 * the saved rows until Save changes, kept per table so moving between
 * tables loses nothing (a dot marks a table with unsaved changes); the
 * Active switch and drag-to-reorder save straight away.
 */
export default function AdminPricingEditor({
  product,
  options,
}: {
  product: AdminProduct;
  options: Record<OptionKind, AdminOption[]>;
}) {
  const router = useRouter();
  const sections = pricingSections(product);
  const [tab, setTab] = useState<Tab>("quantity");
  const [edits, setEdits] = useState<EditsByKind>(NO_EDITS);
  // Saved straight away; shown at once and dropped when the refresh lands.
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [orderOverrides, setOrderOverrides] = useState<Partial<Record<OptionKind, string[]>>>({});
  const [seen, setSeen] = useState(options);
  if (seen !== options) {
    setSeen(options);
    // A save's edits now match what's saved and fall away; a failed one stays.
    setEdits(
      Object.fromEntries(
        Object.entries(edits).map(([kind, kindEdits]) => [
          kind,
          pruneEdits(options[kind as OptionKind], kindEdits),
        ]),
      ) as EditsByKind,
    );
    setActiveOverrides({});
    setOrderOverrides({});
  }
  const [selection, setSelection] = useState<Partial<Selection>>({});

  const shown = (kind: OptionKind): AdminOption[] => {
    const saved = options[kind].map((option) => {
      const override = activeOverrides[`${kind}:${option.slug}`];
      return override === undefined ? option : { ...option, isActive: override };
    });
    const order = orderOverrides[kind];
    if (!order) return saved;
    const bySlug = new Map(saved.map((option) => [option.slug, option]));
    return order.flatMap((slug) => bySlug.get(slug) ?? []);
  };
  const shownByKind = Object.fromEntries(
    sections.map((section) => [section.kind, shown(section.kind)]),
  ) as Record<OptionKind, AdminOption[]>;
  // A board has no size table; its preview has no size axis.
  if (!shownByKind.size) shownByKind.size = [];

  const dirtyKinds = new Set(
    sections
      .filter((section) =>
        options[section.kind].some((option) => changedKeys(option, edits[section.kind][option.slug]).length > 0),
      )
      .map((section) => section.kind),
  );

  useEffect(() => {
    if (dirtyKinds.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyKinds.size]);

  const preview = previewPricingData(shownByKind, edits);
  const resolved = resolveSelection(preview, selection);

  const current = sections.find((section) => section.kind === tab);

  return (
    <div className="grid gap-6 font-body xl:grid-cols-[minmax(0,1fr)_20rem]">
      {/* Scrolls within itself on a phone rather than wrapping, so the underline stays one line. */}
      <nav aria-label="Pricing sections" className="overflow-x-auto xl:col-span-2">
        {/* The rule is an inset shadow, so the current tab's underline paints over it without overflowing. */}
        <ul className="flex min-w-full shadow-[inset_0_-1px_0_var(--color-line)]">
          {[{ kind: "format" as const, title: "Format" }, ...sections].map((entry) => {
            const count = entry.kind === "format" ? null : options[entry.kind].length;
            const dirty = entry.kind !== "format" && dirtyKinds.has(entry.kind);
            return (
              <li key={entry.kind} className="shrink-0">
                <button
                  type="button"
                  aria-current={tab === entry.kind ? "true" : undefined}
                  onClick={() => setTab(entry.kind)}
                  className="flex min-h-13 items-center gap-2 border-b-2 border-transparent px-6 font-medium whitespace-nowrap text-ink-2 transition-colors duration-200 hover:text-ink aria-[current=true]:border-plum aria-[current=true]:text-plum"
                >
                  <span>{entry.title}</span>
                  {dirty && (
                    <span className="h-2 w-2 rounded-full bg-warn-text">
                      <span className="sr-only">, unsaved changes</span>
                    </span>
                  )}
                  {count !== null && <span className="text-sm font-normal text-ink-2">{count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        <div hidden={tab !== "format"}>
          <AdminProductFormatForm product={product} />
        </div>
        {current && (
          <OptionSection
            key={current.kind}
            productSlug={product.slug}
            section={current}
            options={shownByKind[current.kind]}
            saved={options[current.kind]}
            edits={edits[current.kind]}
            previewSlug={resolved?.[KIND_AXIS[current.kind]] ?? null}
            onEdit={(slug, key, value) =>
              setEdits((all) => {
                const option = options[current.kind].find((entry) => entry.slug === slug)!;
                const rowEdits: OptionEdits = { ...all[current.kind][slug] };
                if (isUnchanged(option, key, value)) delete rowEdits[key];
                else rowEdits[key] = value;
                return { ...all, [current.kind]: { ...all[current.kind], [slug]: rowEdits } };
              })
            }
            onDiscard={() => setEdits((all) => ({ ...all, [current.kind]: {} }))}
            onSaved={() => router.refresh()}
            onActive={(slug, isActive) =>
              setActiveOverrides((all) => ({ ...all, [`${current.kind}:${slug}`]: isActive }))
            }
            onActiveFailed={(slug) =>
              setActiveOverrides((all) => {
                const next = { ...all };
                delete next[`${current.kind}:${slug}`];
                return next;
              })
            }
            onOrder={(order) => setOrderOverrides((all) => ({ ...all, [current.kind]: order }))}
            onOrderFailed={() =>
              setOrderOverrides((all) => {
                const next = { ...all };
                delete next[current.kind];
                return next;
              })
            }
          />
        )}
      </div>

      <QuotePreview
        sections={sections}
        data={preview}
        selection={resolved}
        highlight={tab === "format" ? null : KIND_AXIS[tab]}
        onSelect={(axis, value) => setSelection((all) => ({ ...all, [axis]: value }))}
      />
    </div>
  );
}

/**
 * The preview's selection: the one chosen on each axis while it's still
 * offered, else the first (the customer's default). Null when an axis the
 * quote needs has nothing active.
 */
function resolveSelection(data: PricingData, chosen: Partial<Selection>): Selection | null {
  const pick = (options: { id: string }[], id: string | undefined) =>
    (options.find((option) => option.id === id) ?? options[0])?.id;
  const selection = {
    quantity: pick(data.quantity, chosen.quantity),
    pages: pick(data.pages, chosen.pages),
    paper: pick(data.paper, chosen.paper),
    delivery: pick(data.delivery, chosen.delivery),
    size: pick(data.size, chosen.size) ?? "",
  };
  if (!selection.quantity || !selection.pages || !selection.paper || !selection.delivery) return null;
  return selection as Selection;
}

function OptionSection({
  productSlug,
  section,
  options,
  saved,
  edits,
  previewSlug,
  onEdit,
  onDiscard,
  onSaved,
  onActive,
  onActiveFailed,
  onOrder,
  onOrderFailed,
}: {
  productSlug: string;
  section: PricingSection;
  /** In their shown order, with any Active switch just flipped. */
  options: AdminOption[];
  /** As saved, in saved order. */
  saved: AdminOption[];
  edits: Record<string, OptionEdits>;
  previewSlug: string | null;
  onEdit: (slug: string, key: EditKey, value: string) => void;
  onDiscard: () => void;
  onSaved: () => void;
  onActive: (slug: string, isActive: boolean) => void;
  onActiveFailed: (slug: string) => void;
  onOrder: (order: string[]) => void;
  onOrderFailed: () => void;
}) {
  const { kind } = section;
  const fields = KIND_FIELDS[kind];
  const baseUrl = `/api/admin/products/${productSlug}/options/${kind}`;
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);

  const rows = dragOrder
    ? dragOrder.map((slug) => options.find((option) => option.slug === slug)!)
    : options;
  const summary = changeSummary(kind, saved, edits);

  const saveOrder = async (order: string[]) => {
    if (order.every((slug, index) => slug === saved[index]?.slug)) return;
    setError(null);
    onOrder(order);
    const message = await adminMutate(baseUrl, "PUT", { order });
    if (message) {
      setError(message);
      onOrderFailed();
    } else {
      onSaved();
    }
  };

  const moveByKey = (event: KeyboardEvent, slug: string) => {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const order = rows.map((option) => option.slug);
    const next = moveItem(order, slug, order.indexOf(slug) + step);
    if (next.every((entry, index) => entry === order[index])) return;
    void saveOrder(next);
  };

  const dragOver = (event: DragEvent, slug: string) => {
    if (!dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (slug === dragging) return;
    const order = rows.map((option) => option.slug);
    setDragOrder(moveItem(order, dragging, order.indexOf(slug)));
  };

  const endDrag = () => {
    const order = dragOrder;
    setArmed(null);
    setDragging(null);
    setDragOrder(null);
    if (order) void saveOrder(order);
  };

  const toggleActive = async (option: AdminOption, isActive: boolean) => {
    setError(null);
    onActive(option.slug, isActive);
    const message = await adminMutate(`${baseUrl}/${option.slug}`, "PATCH", { isActive });
    if (message) {
      setError(`${option.label}: ${message}`);
      onActiveFailed(option.slug);
    } else {
      onSaved();
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const errors: Record<string, string> = {};
    let savedAny = false;
    for (const option of saved) {
      if (changedKeys(option, edits[option.slug]).length === 0) continue;
      const patch = editsPatch(kind, option, edits[option.slug]);
      if (!patch.ok) {
        errors[option.slug] = patch.error;
        continue;
      }
      const message = await adminMutate(`${baseUrl}/${option.slug}`, "PATCH", patch.payload);
      if (message) errors[option.slug] = message;
      else savedAny = true;
    }
    setRowErrors(errors);
    setSaving(false);
    if (Object.keys(errors).length > 0) {
      setError("Some changes weren't saved — see the highlighted rows.");
    }
    if (savedAny) onSaved();
  };

  const note = SECTION_NOTES[kind];
  const columnCount = 3 + fields.length;

  return (
    <section
      aria-labelledby={`section-${kind}`}
      className="rounded-xl border border-line bg-surface ambient-shadow"
    >
      <div className="px-6 pb-5 pt-6 sm:px-8">
        <h2 id={`section-${kind}`} className="font-display text-3xl text-plum">
          {section.title}
          <span className="ml-3 font-body text-base text-ink-2">
            {options.length} {options.length === 1 ? "option" : "options"}
          </span>
        </h2>
        <p className="mt-2 text-ink-2">
          Drag a row to change the order customers see; the first active one is where they start.
          Switching an option on or off saves straight away.
        </p>
        {note && <p className="mt-2 text-sm text-ink-2">{note}</p>}
      </div>

      {error && (
        <p role="alert" className="mx-6 mb-4 rounded-lg bg-block-bg px-4 py-3 text-sm text-block-text sm:mx-8">
          {error}
        </p>
      )}

      <div className="table-stack table-stack-compact border-t border-line">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line bg-paper text-xs font-medium uppercase tracking-[0.18em] text-ink-label">
              <th className="py-4 pl-4 pr-2">
                {/* A spacer the width of the handle, so the heading lines up with the labels. */}
                <span className="flex items-center gap-1">
                  <span className="w-8" aria-hidden />
                  <span className="px-3">Label</span>
                </span>
              </th>
              {fields.map((field) => (
                <th key={field.key} className="px-2 py-4 text-right">
                  <span className="px-3">{field.label}</span>
                </th>
              ))}
              <th className="px-2 py-4">
                <span className="px-3">Note</span>
              </th>
              <th className="py-4 pl-2 pr-6 text-right">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-8 py-8 text-ink-2">
                  No options yet — add the first one below.
                </td>
              </tr>
            )}
            {rows.map((option) => {
              const rowEdits = edits[option.slug];
              const savedOption = saved.find((entry) => entry.slug === option.slug) ?? option;
              const value = (key: EditKey) => rowEdits?.[key] ?? savedValue(savedOption, key);
              const changed = (key: EditKey) =>
                rowEdits?.[key] !== undefined && !isUnchanged(savedOption, key, rowEdits[key]!);
              const inPreview = option.slug === previewSlug;
              return (
                <tr
                  key={option.slug}
                  draggable={armed === option.slug}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", option.slug);
                    setDragging(option.slug);
                  }}
                  onDragOver={(event) => dragOver(event, option.slug)}
                  onDrop={(event) => event.preventDefault()}
                  onDragEnd={endDrag}
                  className={`border-b border-line last:border-b-0 ${
                    dragging === option.slug
                      ? "bg-mist-2 opacity-70"
                      : inPreview
                        ? "bg-mist-2"
                        : !option.isActive
                          ? "bg-paper"
                          : ""
                  }`}
                >
                  <td data-stack="full" className="py-3 pl-4 pr-2">
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${option.label} — use the up and down arrow keys`}
                        title="Drag to reorder"
                        onPointerDown={() => setArmed(option.slug)}
                        onPointerUp={() => setArmed(null)}
                        onKeyDown={(event) => moveByKey(event, option.slug)}
                        className="flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-3 hover:bg-mist-3 hover:text-ink active:cursor-grabbing"
                      >
                        <GripVertical size={18} aria-hidden />
                      </button>
                      <div className="min-w-0 flex-1">
                        <CellInput
                          label={`Label for ${option.slug}`}
                          value={value("label")}
                          changed={changed("label")}
                          muted={!option.isActive}
                          onChange={(next) => onEdit(option.slug, "label", next)}
                        />
                        <p className="px-3 text-sm text-ink-3">
                          slug {option.slug}
                          {inPreview && " · used in the preview"}
                        </p>
                        {rowErrors[option.slug] && changedKeys(savedOption, rowEdits).length > 0 && (
                          <p className="px-3 pt-1 text-sm text-block-text">{rowErrors[option.slug]}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {fields.map((field) => (
                    <td key={field.key} data-label={field.label} className="px-2 py-3 align-top">
                      <CellInput
                        label={`${field.label} for ${option.slug}`}
                        value={value(field.key)}
                        changed={changed(field.key)}
                        muted={!option.isActive}
                        numeric
                        onChange={(next) => onEdit(option.slug, field.key, next)}
                      />
                    </td>
                  ))}
                  <td data-label="Note" className="px-2 py-3 align-top">
                    <CellInput
                      label={`Note for ${option.slug}`}
                      value={value("note")}
                      changed={changed("note")}
                      muted={!option.isActive}
                      onChange={(next) => onEdit(option.slug, "note", next)}
                    />
                  </td>
                  <td data-label="Active" className="py-3 pl-2 pr-6 align-top">
                    <div className="flex justify-end">
                      <AdminSwitch
                        checked={option.isActive}
                        label={`${option.label} active`}
                        onChange={(next) => void toggleActive(option, next)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {summary && (
        <div className="flex flex-wrap items-center gap-4 border-t border-line bg-mist-3 px-6 py-4 sm:px-8">
          <p className="text-plum-deep">
            <span className="font-medium">{summary.count}</span> · {summary.detail}
          </p>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={() => {
                setRowErrors({});
                setError(null);
                onDiscard();
              }}
              disabled={saving}
              className="btn btn-outline min-h-11 border-line-2 px-6 text-ink"
            >
              Discard
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary min-h-11 px-6">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-line px-6 py-4 sm:px-8">
        {adding ? (
          <NewOptionForm
            kind={kind}
            singular={section.singular}
            url={baseUrl}
            sortOrder={saved.reduce((max, option) => Math.max(max, option.sortOrder + 1), 0)}
            onCancel={() => setAdding(false)}
            onCreated={() => {
              setAdding(false);
              onSaved();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-ghost -ml-4 min-h-11 px-4 text-plum"
          >
            <Plus size={18} aria-hidden />
            Add {section.singular}
          </button>
        )}
      </div>
    </section>
  );
}

/** A table cell edited in place: reads as text until hovered, focused or changed. */
function CellInput({
  label,
  value,
  changed,
  muted,
  numeric = false,
  onChange,
}: {
  label: string;
  value: string;
  changed: boolean;
  muted: boolean;
  numeric?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      inputMode={numeric ? "decimal" : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={`min-h-11 w-full min-w-0 rounded-md border px-3 py-2 focus:border-plum focus:bg-surface focus:outline-none focus:ring-3 focus:ring-focus-ring ${
        numeric ? "text-right tabular-nums" : ""
      } ${
        changed
          ? "border-plum bg-mist-2 text-plum-deep"
          : `border-transparent bg-transparent hover:border-line-2 ${muted ? "text-ink-3" : "text-ink"}`
      }`}
    />
  );
}

function NewOptionForm({
  kind,
  singular,
  url,
  sortOrder,
  onCancel,
  onCreated,
}: {
  kind: OptionKind;
  singular: string;
  url: string;
  /** After the last option, so a new one never becomes the default by accident. */
  sortOrder: number;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const id = useId();
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [note, setNote] = useState("");
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = newOptionPayload(kind, values);
    if (!parsed.ok) return setError(parsed.error);
    setSaving(true);
    setError(null);
    const message = await adminMutate(url, "POST", {
      slug,
      label,
      note: note.trim() === "" ? null : note.trim(),
      sortOrder,
      ...parsed.payload,
    });
    setSaving(false);
    if (message) setError(message);
    else onCreated();
  };

  const input = (key: string, text: string, value: string, onChange: (value: string) => void, extra = "") => (
    <div className={extra}>
      <label htmlFor={`${id}-${key}`} className="mb-2 block font-medium text-ink">
        {text}
      </label>
      <input
        id={`${id}-${key}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field min-h-11 py-2"
      />
    </div>
  );

  return (
    <form onSubmit={create} aria-label={`New ${singular}`}>
      <h3 className="mb-4 font-display text-xl text-plum">New {singular}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {input("label", "Label", label, (next) => {
          setLabel(next);
          if (!slugEdited) setSlug(suggestSlug(next));
        })}
        {input("slug", "Slug (permanent)", slug, (next) => {
          setSlug(next);
          setSlugEdited(true);
        })}
        {KIND_FIELDS[kind].map((field) =>
          input(field.key, field.label, values[field.key] ?? "", (next) =>
            setValues((all) => ({ ...all, [field.key]: next })),
          ),
        )}
        {input(
          "note",
          kind === "delivery" ? "Note (required)" : "Note (optional)",
          note,
          setNote,
          "sm:col-span-2",
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-block-bg px-4 py-3 text-sm text-block-text">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={saving || !label.trim() || !slug} className="btn btn-primary min-h-11 px-6">
          {saving ? "Adding…" : `Add ${singular}`}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-outline min-h-11 border-line-2 px-6 text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

function QuotePreview({
  sections,
  data,
  selection,
  highlight,
  onSelect,
}: {
  sections: PricingSection[];
  data: PricingData;
  selection: Selection | null;
  highlight: keyof PricingData | null;
  onSelect: (axis: keyof Selection, value: string) => void;
}) {
  const id = useId();
  const quote = selection ? getQuote(data, selection) : null;
  const axisLabel = (kind: OptionKind) => sections.find((section) => section.kind === kind)?.axisLabel ?? "";
  // The preview asks in the buy box's order: what's printed, then how many, then delivery.
  const axes = (["page-count", "paper", "size", "quantity", "delivery"] as const).filter(
    (kind) => data[KIND_AXIS[kind]].length > 0,
  );

  const line = (axis: keyof PricingData | null, label: string, value: string) => (
    <div
      key={label}
      className={`-mx-3 flex items-baseline justify-between gap-3 border-b border-line px-3 py-3 ${
        axis && axis === highlight ? "rounded-md bg-mist-2" : ""
      }`}
    >
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );

  return (
    <aside
      aria-labelledby={`${id}-title`}
      className="h-fit rounded-xl border border-line bg-surface p-6 ambient-shadow xl:sticky xl:top-6"
    >
      <h2 id={`${id}-title`} className="font-display text-2xl text-plum">
        Quote preview
      </h2>
      <p className="mt-1 text-sm text-ink-2">Updates as you edit, before you save.</p>

      <div className="mt-5 flex flex-col gap-4">
        {axes.map((kind) => {
          const axis = KIND_AXIS[kind];
          return (
            <div key={kind}>
              <label htmlFor={`${id}-${kind}`} className="mb-2 block text-sm font-medium text-ink">
                {axisLabel(kind)}
              </label>
              <select
                id={`${id}-${kind}`}
                value={selection?.[axis] ?? data[axis][0]?.id}
                onChange={(event) => onSelect(axis, event.target.value)}
                className="field min-h-11 py-2"
              >
                {data[axis].map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {quote ? (
        <>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-ink-label">Breakdown</p>
          <dl className="mt-1">
            {line("pages", `Base rate · ${quote.pages.label}`, formatPence(quote.pages.baseRatePence))}
            {line("paper", `${axisLabel("paper")} · ${quote.paper.label}`, `× ${quote.paper.multiplier}`)}
            {quote.size && line("size", `Size · ${quote.size.label}`, `× ${quote.size.multiplier}`)}
            {line("quantity", `Quantity · ${quote.quantity.label}`, `× ${quote.quantity.multiplier}`)}
            {line(null, "Per copy, to the penny", formatPence(quote.unitPricePence))}
            {line(null, `Print · ${copiesText(quote.quantity.value)}`, formatPence(quote.printCostPence))}
            {line("delivery", `Delivery · ${quote.delivery.label}`, `+ ${formatPence(quote.delivery.pricePence)}`)}
          </dl>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="font-medium text-ink">Total</span>
            <span className="font-display text-3xl text-plum">{formatPence(quote.totalPence)}</span>
          </div>
        </>
      ) : (
        <p className="mt-6 rounded-lg bg-warn-bg px-4 py-3 text-sm text-ink">
          Nothing to price yet: customers need at least one active option in every table but print
          sizes.
        </p>
      )}
    </aside>
  );
}
