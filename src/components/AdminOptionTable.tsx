"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import type { AdminOption, OptionKind } from "@/lib/adminCatalogue.server";
import { adminMutate } from "@/lib/adminClient";
import { penceToPoundsInput, poundsToPence } from "@/lib/money";

/** Numeric column keys, beyond the shared label/note/sort/active columns. */
type FieldKey = "multiplier" | "copies" | "pageCount" | "baseRatePence" | "pricePence";

interface FieldDef {
  key: FieldKey;
  label: string;
  /** "pounds" fields are typed in pounds and stored as integer pence. */
  input: "number" | "pounds";
}

const KIND_FIELDS: Record<OptionKind, FieldDef[]> = {
  size: [{ key: "multiplier", label: "Multiplier", input: "number" }],
  colour: [{ key: "multiplier", label: "Multiplier", input: "number" }],
  paper: [{ key: "multiplier", label: "Multiplier", input: "number" }],
  quantity: [
    { key: "multiplier", label: "Multiplier", input: "number" },
    { key: "copies", label: "Copies", input: "number" },
  ],
  "page-count": [
    { key: "pageCount", label: "Pages", input: "number" },
    { key: "baseRatePence", label: "Base rate (£)", input: "pounds" },
  ],
  delivery: [{ key: "pricePence", label: "Price (£)", input: "pounds" }],
};

function initialFieldValue(option: AdminOption, field: FieldDef): string {
  const raw = option[field.key];
  if (raw === undefined) return "";
  return field.input === "pounds" ? penceToPoundsInput(raw) : String(raw);
}

/**
 * Turn the typed field strings into the API payload. Returns an error
 * message for a value that doesn't parse (never rounds silently).
 */
function fieldPayload(
  fields: FieldDef[],
  values: Record<string, string>,
): { ok: true; payload: Record<string, number> } | { ok: false; error: string } {
  const payload: Record<string, number> = {};
  for (const field of fields) {
    const raw = values[field.key]?.trim() ?? "";
    if (field.input === "pounds") {
      const pence = poundsToPence(raw);
      if (pence === null) {
        return { ok: false, error: `${field.label} must be a price like 2.20` };
      }
      payload[field.key] = pence;
    } else {
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) {
        return { ok: false, error: `${field.label} must be a number` };
      }
      payload[field.key] = value;
    }
  }
  return { ok: true, payload };
}

export default function AdminOptionTable({
  productSlug,
  kind,
  title,
  options,
}: {
  productSlug: string;
  kind: OptionKind;
  title: string;
  options: AdminOption[];
}) {
  const fields = KIND_FIELDS[kind];

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest ambient-shadow">
      <h2 className="border-b border-outline-variant/40 px-5 py-4 font-display text-lg text-primary">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              <th className="px-5 py-3">Slug</th>
              <th className="px-5 py-3">Label</th>
              {fields.map((field) => (
                <th key={field.key} className="px-5 py-3">
                  {field.label}
                </th>
              ))}
              <th className="px-5 py-3">Note</th>
              <th className="px-5 py-3">Sort</th>
              <th className="px-5 py-3">Active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {options.length === 0 && (
              <tr>
                <td
                  colSpan={6 + fields.length}
                  className="px-5 py-6 font-body text-sm text-on-surface-variant"
                >
                  No options yet — add the first one below.
                </td>
              </tr>
            )}
            {options.map((option) => (
              <OptionRow
                key={option.slug}
                productSlug={productSlug}
                kind={kind}
                fields={fields}
                option={option}
              />
            ))}
          </tbody>
        </table>
      </div>
      <CreateOptionRow productSlug={productSlug} kind={kind} fields={fields} />
    </section>
  );
}

const cellInput =
  "rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body text-sm focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15";

function OptionRow({
  productSlug,
  kind,
  fields,
  option,
}: {
  productSlug: string;
  kind: OptionKind;
  fields: FieldDef[];
  option: AdminOption;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(option.label);
  const [note, setNote] = useState(option.note ?? "");
  const [sortOrder, setSortOrder] = useState(String(option.sortOrder));
  const [isActive, setIsActive] = useState(option.isActive);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, initialFieldValue(option, field)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = fieldPayload(fields, values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    const message = await adminMutate(
      `/api/admin/products/${productSlug}/options/${kind}/${option.slug}`,
      "PATCH",
      {
        label,
        note: note.trim() === "" ? null : note.trim(),
        sortOrder: Number(sortOrder),
        isActive,
        ...parsed.payload,
      },
    );
    setSaving(false);
    if (message) setError(message);
    else router.refresh();
  };

  return (
    <tr className="border-b border-outline-variant/20 font-body text-sm text-on-surface last:border-b-0">
      <td className="px-5 py-3 text-on-surface-variant">{option.slug}</td>
      <td className="px-5 py-3">
        <input
          aria-label={`Label for ${option.slug}`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className={`${cellInput} w-full min-w-36`}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-primary">
            {error}
          </p>
        )}
      </td>
      {fields.map((field) => (
        <td key={field.key} className="px-5 py-3">
          <input
            aria-label={`${field.label} for ${option.slug}`}
            value={values[field.key]}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.key]: event.target.value }))
            }
            className={`${cellInput} w-24`}
          />
        </td>
      ))}
      <td className="px-5 py-3">
        <input
          aria-label={`Note for ${option.slug}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={`${cellInput} w-full min-w-44`}
        />
      </td>
      <td className="px-5 py-3">
        <input
          aria-label={`Sort order for ${option.slug}`}
          type="number"
          min={0}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          className={`${cellInput} w-16`}
        />
      </td>
      <td className="px-5 py-3">
        <input
          aria-label={`${option.slug} active`}
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

function CreateOptionRow({
  productSlug,
  kind,
  fields,
}: {
  productSlug: string;
  kind: OptionKind;
  fields: FieldDef[];
}) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = fieldPayload(fields, values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    const message = await adminMutate(
      `/api/admin/products/${productSlug}/options/${kind}`,
      "POST",
      {
        slug,
        label,
        note: note.trim() === "" ? null : note.trim(),
        ...parsed.payload,
      },
    );
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setSlug("");
    setLabel("");
    setNote("");
    setValues({});
    router.refresh();
  };

  return (
    <form
      onSubmit={create}
      className="flex flex-wrap items-end gap-3 border-t border-outline-variant/40 px-5 py-4"
    >
      <input
        aria-label="New option slug"
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
        placeholder="slug"
        className={`${cellInput} w-32`}
      />
      <input
        aria-label="New option label"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Label"
        className={`${cellInput} w-40`}
      />
      {fields.map((field) => (
        <input
          key={field.key}
          aria-label={`New option ${field.label}`}
          value={values[field.key] ?? ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, [field.key]: event.target.value }))
          }
          placeholder={field.label}
          className={`${cellInput} w-28`}
        />
      ))}
      <input
        aria-label="New option note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={kind === "delivery" ? "Note (required)" : "Note (optional)"}
        className={`${cellInput} w-56`}
      />
      <button
        type="submit"
        disabled={saving || !slug || !label}
        className="flex items-center gap-2 rounded-lg border-2 border-primary-container px-4 py-2 font-body text-sm font-medium text-primary-container transition-colors duration-300 hover:bg-surface-container disabled:opacity-40"
      >
        <Plus size={15} aria-hidden />
        {saving ? "Adding…" : "Add option"}
      </button>
      {error && (
        <p role="alert" className="w-full font-body text-sm text-primary">
          {error}
        </p>
      )}
    </form>
  );
}
