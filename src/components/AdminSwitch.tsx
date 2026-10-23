"use client";

/**
 * An on/off switch for the admin tables and panels — a button with
 * role="switch", so it's read out as "on"/"off" and toggles with Space.
 */
export default function AdminSwitch({
  checked,
  label,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-11 shrink-0 items-center disabled:cursor-not-allowed"
    >
      <span
        className={`relative h-7 w-12 rounded-full motion-safe:transition-colors group-disabled:opacity-60 ${
          checked ? "bg-plum" : "bg-line-2"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm motion-safe:transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
