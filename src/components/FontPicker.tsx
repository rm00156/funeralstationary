"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  FONT_GROUP_LABELS,
  FONT_OPTIONS,
  type FontFamilyId,
  type FontGroup,
} from "@/lib/designEditor";

/**
 * The editor's font picker, each name drawn in its own face — a native
 * `<select>` can't do that (macOS and most mobile browsers ignore an
 * `<option>`'s font), so a customer would be choosing between ~50 names.
 *
 * A button + listbox following the ARIA select-only combobox pattern: arrows,
 * Home/End and type-ahead move, Enter/Space choose, Escape and Tab close. The
 * list is portalled to `<body>` at a fixed position because the selection bar
 * it sits in scrolls sideways and would clip it; it closes rather than follow
 * when anything scrolls or resizes.
 */
export function FontPicker({
  value,
  onChange,
}: {
  value: FontFamilyId;
  onChange: (id: FontFamilyId) => void;
}) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeAhead = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => indexOf(value));
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(
    null,
  );

  const current = FONT_OPTIONS[indexOf(value)] ?? FONT_OPTIONS[0];

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  const choose = useCallback(
    (index: number) => {
      const font = FONT_OPTIONS[index];
      if (font && font.id !== value) onChange(font.id);
      close(true);
    },
    [close, onChange, value],
  );

  const openList = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 4;
    const margin = 12;
    setPosition({
      top: rect.bottom + gap,
      left: Math.max(margin, rect.left),
      maxHeight: Math.max(200, window.innerHeight - rect.bottom - gap - margin),
    });
    setActive(indexOf(value));
    setOpen(true);
  };

  // Focus the list and bring the current font into view as it opens.
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    optionElement(listRef.current, active)?.scrollIntoView?.({ block: "center" });
    // Only on open — keyboard moves scroll themselves below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (event: Event) => {
      // Scrolling the list itself is how you browse it.
      if (listRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const move = (index: number) => {
    const next = Math.min(FONT_OPTIONS.length - 1, Math.max(0, index));
    setActive(next);
    optionElement(listRef.current, next)?.scrollIntoView?.({ block: "nearest" });
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(active + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        move(active - 1);
        return;
      case "Home":
        event.preventDefault();
        move(0);
        return;
      case "End":
        event.preventDefault();
        move(FONT_OPTIONS.length - 1);
        return;
      case "PageDown":
        event.preventDefault();
        move(active + 8);
        return;
      case "PageUp":
        event.preventDefault();
        move(active - 8);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        return;
      case "Escape":
        event.preventDefault();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      const typed = now - typeAhead.current.at > 700 ? event.key : typeAhead.current.text + event.key;
      typeAhead.current = { text: typed, at: now };
      const match = findByPrefix(typed, active);
      if (match >= 0) move(match);
    }
  };

  const onButtonKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openList();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Font: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onButtonKeyDown}
        className="flex w-44 shrink-0 items-center justify-between gap-2 rounded-md border border-outline-variant/60 bg-surface-container-lowest px-2 py-1.5 text-left text-base"
      >
        <span className="truncate" style={{ fontFamily: current.css }}>
          {current.label}
        </span>
        <ChevronDown size={16} aria-hidden className="shrink-0 text-on-surface-variant" />
      </button>

      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label="Font"
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKeyDown}
            style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
            className="fixed z-50 w-72 overflow-y-auto rounded-xl border border-outline-variant/60 bg-surface-container-lowest py-1 shadow-menu outline-none"
          >
            {FONT_GROUPS.map((group) => (
              <li key={group} role="group" aria-labelledby={`${listId}-${group}`}>
                <div id={`${listId}-${group}`} className="eyebrow px-4 pb-1 pt-3 font-body">
                  {FONT_GROUP_LABELS[group]}
                </div>
                <ul role="presentation">
                  {FONT_OPTIONS.map((font, index) => {
                    if (font.group !== group) return null;
                    const selected = font.id === value;
                    return (
                      <li
                        key={font.id}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={selected}
                        onPointerMove={() => active !== index && setActive(index)}
                        onClick={() => choose(index)}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 px-4 py-1.5 text-on-surface ${
                          index === active ? "bg-surface-container" : ""
                        }`}
                      >
                        <span className="w-4 shrink-0 text-primary">
                          {selected && <Check size={16} aria-hidden />}
                        </span>
                        <span
                          className="truncate"
                          style={{ fontFamily: font.css, fontSize: group === "script" ? 24 : 19 }}
                        >
                          {font.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}

/** Groups in the order FONT_OPTIONS lists them, so list order = arrow order. */
const FONT_GROUPS: FontGroup[] = [...new Set(FONT_OPTIONS.map((font) => font.group))];

function indexOf(id: FontFamilyId): number {
  const index = FONT_OPTIONS.findIndex((font) => font.id === id);
  return index < 0 ? 0 : index;
}

function optionElement(list: HTMLElement | null, index: number): HTMLElement | null {
  return list?.querySelectorAll<HTMLElement>('[role="option"]')[index] ?? null;
}

/**
 * The next font whose name starts with `typed`, searching on from the active
 * one so pressing the same letter again cycles through its fonts.
 */
export function findByPrefix(typed: string, from: number): number {
  const needle = typed.toLowerCase();
  const n = FONT_OPTIONS.length;
  // A repeated single letter ("ppp") cycles rather than looking for "ppp".
  const cycling = needle.length > 1 && [...needle].every((ch) => ch === needle[0]);
  const prefix = cycling ? needle[0] : needle;
  const start = cycling || needle.length === 1 ? from + 1 : from;
  for (let step = 0; step < n; step++) {
    const index = (start + step) % n;
    if (FONT_OPTIONS[index].label.toLowerCase().startsWith(prefix)) return index;
  }
  return -1;
}
