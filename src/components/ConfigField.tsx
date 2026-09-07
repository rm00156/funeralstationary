"use client";

import { ChevronDown } from "lucide-react";

export interface ConfigFieldProps {
  id: string;
  label: string;
  value: string;
  note?: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** A labelled select in the configurator's style — shared by the product page and the basket. */
export default function ConfigField({
  id,
  label,
  value,
  note,
  options,
  onChange,
  disabled,
}: ConfigFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-body text-xs font-medium uppercase tracking-[0.18em] text-secondary mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg bg-canvas-cream px-4 py-3.5 pr-12 font-body text-base text-on-surface border border-transparent border-b-outline-variant transition-colors duration-300 hover:bg-surface-container-low focus:border-primary-container focus:outline-none focus:ring-4 focus:ring-primary-container/15 disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-outline"
        />
      </div>
      {note && (
        <p className="mt-2 font-body text-sm text-on-surface-variant">{note}</p>
      )}
    </div>
  );
}
