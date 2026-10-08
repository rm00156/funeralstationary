"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A question asked in the page's own modal rather than the browser's
 * `confirm()`/`prompt()`, which reads "localhost:3000 says" in the browser's
 * own chrome and frightens the customers this site is for.
 *
 * Built on `<dialog>` + `showModal()`, so focus is trapped, Escape cancels and
 * the page behind is inert without any of that being re-implemented here.
 * Focus lands on the first control — the field when there is one, otherwise
 * Cancel, so a stray Enter never confirms a removal.
 */
export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface PromptOptions extends ConfirmOptions {
  /** The field's label, read out with it; the title stays the heading. */
  label: string;
  defaultValue?: string;
}

type Request =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

/**
 * `const { confirm, prompt, dialog } = useConfirmDialog()` — render `dialog`
 * once, then `if (!(await confirm({ … }))) return;` wherever a native
 * `window.confirm` would have been.
 */
export function useConfirmDialog() {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setRequest({ kind: "confirm", options, resolve })),
    [],
  );
  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => setRequest({ kind: "prompt", options, resolve })),
    [],
  );

  const settle = (value: string | null) => {
    if (!request) return;
    if (request.kind === "confirm") request.resolve(value !== null);
    else request.resolve(value);
    setRequest(null);
  };

  const dialog = request ? (
    <ConfirmDialog
      {...request.options}
      field={
        request.kind === "prompt"
          ? { label: request.options.label, defaultValue: request.options.defaultValue ?? "" }
          : undefined
      }
      onConfirm={(value) => settle(value)}
      onCancel={() => settle(null)}
    />
  ) : null;

  return { confirm, prompt, dialog };
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  field,
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  field?: { label: string; defaultValue: string };
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(field?.defaultValue ?? "");
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      // Escape: let the parent unmount it rather than the browser close it.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="m-auto w-[calc(100vw-32px)] max-w-lg rounded-xl bg-surface p-0 text-ink shadow-menu backdrop:bg-plum-night/60"
    >
      <form
        className="type-body p-6 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(value);
        }}
      >
        <h2 id={`${id}-title`} className="font-display text-2xl text-ink">
          {title}
        </h2>
        {message && <p className="mt-3 text-ink-2">{message}</p>}
        {field && (
          <label className="mt-5 block">
            <span className="sr-only">{field.label}</span>
            <input
              className="field"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.target.select()}
            />
          </label>
        )}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="submit" className="btn btn-primary">
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
