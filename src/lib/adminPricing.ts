/**
 * The /admin/products/[slug] pricing editor's decisions: which columns each
 * option table has, the unsaved edits held over the saved rows, the change
 * summary and PATCH they become, and the preview prices drawn from them.
 * Pure and client-safe (types only from the admin seam).
 */
import type { AdminOption, OptionKind } from "@/lib/adminCatalogue.server";
import { penceToPoundsInput, poundsToPence } from "@/lib/money";
import { copiesText, type PricingData } from "@/lib/orderOfServicePricing";

/** Numeric column keys, beyond the shared label / note / active columns. */
export type FieldKey =
  | "multiplier"
  | "copies"
  | "pageCount"
  | "baseRatePence"
  | "pricePence"
  | "widthMm"
  | "heightMm";

export interface FieldDef {
  key: FieldKey;
  label: string;
  /** "pounds" fields are typed in pounds and stored as integer pence. */
  input: "number" | "pounds";
}

export const KIND_FIELDS: Record<OptionKind, FieldDef[]> = {
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
  size: [
    { key: "multiplier", label: "Multiplier", input: "number" },
    { key: "widthMm", label: "Width (mm)", input: "number" },
    { key: "heightMm", label: "Height (mm)", input: "number" },
  ],
};

/** A column an admin edits in place: the label, the note, or one of the kind's fields. */
export type EditKey = "label" | "note" | FieldKey;

/** Typed-but-unsaved values for one option, by column. */
export type OptionEdits = Partial<Record<EditKey, string>>;

/** The saved value of a column, as its input shows it. */
export function savedValue(option: AdminOption, key: EditKey): string {
  if (key === "label") return option.label;
  if (key === "note") return option.note ?? "";
  const raw = option[key];
  if (raw === undefined) return "";
  return fieldDef(key)?.input === "pounds" ? penceToPoundsInput(raw) : String(raw);
}

function fieldDef(key: EditKey): FieldDef | undefined {
  for (const fields of Object.values(KIND_FIELDS)) {
    const found = fields.find((field) => field.key === key);
    if (found) return found;
  }
  return undefined;
}

/**
 * What a typed value means, for comparing it with the saved one: pence for
 * a price, a number for a number, trimmed text otherwise. Null when it
 * doesn't parse, so it can never equal a saved value.
 */
function typedValue(key: EditKey, text: string): string | number | null {
  if (key === "label" || key === "note") return text.trim();
  if (fieldDef(key)?.input === "pounds") return poundsToPence(text);
  const value = Number(text.trim());
  return text.trim() === "" || !Number.isFinite(value) ? null : value;
}

export function isUnchanged(option: AdminOption, key: EditKey, text: string): boolean {
  return typedValue(key, text) === typedValue(key, savedValue(option, key));
}

/** The columns of an option whose edits differ from what's saved. */
export function changedKeys(option: AdminOption, edits: OptionEdits | undefined): EditKey[] {
  if (!edits) return [];
  return (Object.keys(edits) as EditKey[]).filter(
    (key) => edits[key] !== undefined && !isUnchanged(option, key, edits[key]!),
  );
}

/** Edits that still differ from the saved rows — after a save, the saved ones fall away. */
export function pruneEdits(
  options: AdminOption[],
  edits: Record<string, OptionEdits>,
): Record<string, OptionEdits> {
  const pruned: Record<string, OptionEdits> = {};
  for (const option of options) {
    const keys = changedKeys(option, edits[option.slug]);
    if (keys.length > 0) {
      pruned[option.slug] = Object.fromEntries(keys.map((key) => [key, edits[option.slug][key]]));
    }
  }
  return pruned;
}

const COLUMN_NAMES: Record<EditKey, string> = {
  label: "label",
  note: "note",
  multiplier: "multiplier",
  copies: "copies",
  pageCount: "pages",
  baseRatePence: "base rate",
  pricePence: "price",
  widthMm: "width",
  heightMm: "height",
};

/** How a row is named in the change summary: "25 copies", "8 page", "Silk". */
export function optionName(kind: OptionKind, option: AdminOption): string {
  return kind === "quantity" && option.copies !== undefined ? copiesText(option.copies) : option.label;
}

/**
 * The unsaved-changes line, in two parts: "1 unsaved change" and, for one
 * option, what changed — "25 copies, multiplier 0.95 → 0.85" — or for
 * several, how many. Null when nothing has changed.
 */
export function changeSummary(
  kind: OptionKind,
  options: AdminOption[],
  edits: Record<string, OptionEdits>,
): { count: string; detail: string } | null {
  const changed = options
    .map((option) => ({ option, keys: changedKeys(option, edits[option.slug]) }))
    .filter((entry) => entry.keys.length > 0);
  const total = changed.reduce((sum, entry) => sum + entry.keys.length, 0);
  if (total === 0) return null;
  const count = `${total} unsaved ${total === 1 ? "change" : "changes"}`;
  if (changed.length > 1) return { count, detail: `across ${changed.length} options` };
  const [{ option, keys }] = changed;
  const detail = keys
    .map((key) => {
      const from = savedValue(option, key) || "blank";
      const to = edits[option.slug][key]!.trim() || "blank";
      return `${COLUMN_NAMES[key]} ${from} → ${to}`;
    })
    .join(", ");
  return { count, detail: `${optionName(kind, option)}, ${detail}` };
}

/**
 * The PATCH body for one option's changed columns, or the first column's
 * error for a value that doesn't parse (never rounded silently). A cleared
 * note is sent as null.
 */
export function editsPatch(
  kind: OptionKind,
  option: AdminOption,
  edits: OptionEdits | undefined,
): { ok: true; payload: Record<string, string | number | null> } | { ok: false; error: string } {
  const payload: Record<string, string | number | null> = {};
  for (const key of changedKeys(option, edits)) {
    const text = edits![key]!.trim();
    if (key === "label") {
      if (!text) return { ok: false, error: "The label can't be blank" };
      payload.label = text;
    } else if (key === "note") {
      payload.note = text === "" ? null : text;
    } else {
      const field = KIND_FIELDS[kind].find((entry) => entry.key === key)!;
      const value = typedValue(key, text);
      if (value === null) {
        return {
          ok: false,
          error:
            field.input === "pounds"
              ? `${field.label} must be a price like 2.20`
              : `${field.label} must be a number`,
        };
      }
      payload[key] = value;
    }
  }
  return { ok: true, payload };
}

/** The new-option form's payload: every field of the kind, parsed. */
export function newOptionPayload(
  kind: OptionKind,
  values: Partial<Record<FieldKey, string>>,
): { ok: true; payload: Record<string, number> } | { ok: false; error: string } {
  const payload: Record<string, number> = {};
  for (const field of KIND_FIELDS[kind]) {
    const value = typedValue(field.key, values[field.key] ?? "");
    if (value === null || typeof value === "string") {
      return {
        ok: false,
        error:
          field.input === "pounds"
            ? `${field.label} must be a price like 2.20`
            : `${field.label} must be a number`,
      };
    }
    payload[field.key] = value;
  }
  return { ok: true, payload };
}

/** An option as the preview prices it: its edits over its saved values, where they parse. */
function edited(option: AdminOption, edits: OptionEdits | undefined): AdminOption {
  const merged: AdminOption = { ...option };
  for (const key of changedKeys(option, edits)) {
    const value = typedValue(key, edits![key]!);
    if (value === null) continue;
    if (key === "label") merged.label = String(value) || option.label;
    else if (key === "note") merged.note = String(value) || null;
    else if (typeof value === "number") merged[key] = value;
  }
  return merged;
}

/**
 * The PricingData the quote preview prices with: each kind's active
 * options, in their shown order, with the unsaved edits applied — so the
 * preview answers "what would a customer pay if I saved this?".
 */
export function previewPricingData(
  options: Record<OptionKind, AdminOption[]>,
  edits: Record<OptionKind, Record<string, OptionEdits>>,
): PricingData {
  const live = (kind: OptionKind) =>
    options[kind]
      .filter((option) => option.isActive)
      .map((option) => edited(option, edits[kind][option.slug]));
  return {
    quantity: live("quantity").map((option) => ({
      id: option.slug,
      label: option.label,
      multiplier: option.multiplier ?? 1,
      value: option.copies ?? 1,
    })),
    pages: live("page-count").map((option) => ({
      id: option.slug,
      label: option.label,
      pages: option.pageCount ?? 1,
      baseRatePence: option.baseRatePence ?? 0,
    })),
    paper: live("paper").map((option) => ({
      id: option.slug,
      label: option.label,
      multiplier: option.multiplier ?? 1,
    })),
    delivery: live("delivery").map((option) => ({
      id: option.slug,
      label: option.label,
      pricePence: option.pricePence ?? 0,
      note: option.note ?? "",
    })),
    size: live("size").map((option) => ({
      id: option.slug,
      label: option.label,
      multiplier: option.multiplier ?? 1,
      widthMm: option.widthMm ?? 0,
      heightMm: option.heightMm ?? 0,
    })),
  };
}

/** `items` with `item` moved to `toIndex` (clamped); unchanged when it isn't there. */
export function moveItem<T>(items: T[], item: T, toIndex: number): T[] {
  const from = items.indexOf(item);
  if (from === -1) return items;
  const next = [...items];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, items.length - 1)), 0, item);
  return next;
}

export interface PricingSection {
  kind: OptionKind;
  /** The section's heading and its tab. */
  title: string;
  /** "Add quantity", "Add page count". */
  singular: string;
  /** The quote preview's name for the axis. */
  axisLabel: string;
}

/**
 * The option tables a product's pricing page shows, in the order the buy
 * box asks. A board's page-count options are its sizes already
 * (sizeFormatError), so it has no separate print sizes; a product that
 * calls its paper something else ("Finish") is titled by that name.
 */
export function pricingSections(product: { sizedByOption: boolean; paperLabel: string }): PricingSection[] {
  const paperNamed = product.paperLabel !== "Paper";
  const sections: (PricingSection | null)[] = [
    { kind: "quantity", title: "Quantities", singular: "quantity", axisLabel: "Quantity" },
    product.sizedByOption
      ? { kind: "page-count", title: "Sizes", singular: "size", axisLabel: "Size" }
      : { kind: "page-count", title: "Page counts", singular: "page count", axisLabel: "Page count" },
    product.sizedByOption
      ? null
      : { kind: "size", title: "Print sizes", singular: "print size", axisLabel: "Size" },
    {
      kind: "paper",
      title: paperNamed ? `${product.paperLabel} options` : "Paper stocks",
      singular: paperNamed ? product.paperLabel.toLowerCase() : "paper stock",
      axisLabel: product.paperLabel,
    },
    { kind: "delivery", title: "Delivery", singular: "delivery option", axisLabel: "Delivery" },
  ];
  return sections.filter((section): section is PricingSection => section !== null);
}

/** The quote preview's selection axis for each option kind. */
export const KIND_AXIS = {
  quantity: "quantity",
  "page-count": "pages",
  paper: "paper",
  delivery: "delivery",
  size: "size",
} as const satisfies Record<OptionKind, keyof PricingData>;
