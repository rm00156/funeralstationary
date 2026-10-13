"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, Phone } from "lucide-react";

import { reveal } from "@/lib/focusFirstError";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

/**
 * What a public form (contact, trade application) turns into once it has
 * sent: a confirmation in the form's own card, scrolled into view and
 * focused, so the visitor sees it went — the Send button they clicked is at
 * the foot of a long form, and a message at its top would be out of sight.
 * `onAgain` brings an empty form back.
 */
export default function FormSent({
  title,
  children,
  againLabel,
  onAgain,
}: {
  title: string;
  children: React.ReactNode;
  againLabel: string;
  onAgain: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (panelRef.current) reveal(panelRef.current, { focus: true });
  }, []);

  return (
    <div
      ref={panelRef}
      role="status"
      tabIndex={-1}
      aria-labelledby="form-sent-title"
      className="flex flex-col items-start gap-4 rounded-2xl border border-success-border bg-surface p-7 outline-none sm:p-11"
    >
      <CircleCheck size={40} strokeWidth={1.6} aria-hidden className="text-star" />
      <h2 id="form-sent-title" className="type-sub">
        {title}
      </h2>
      <div className="flex max-w-[38em] flex-col gap-3 text-ink-2">{children}</div>
      <p className="text-base text-ink-2">
        Urgent? Call us on{" "}
        <a href={PHONE_HREF} className="link inline-flex items-center gap-1.5 font-semibold">
          <Phone size={16} strokeWidth={1.8} aria-hidden />
          {PHONE_DISPLAY}
        </a>
        .
      </p>
      <button type="button" onClick={onAgain} className="btn btn-outline mt-2 min-h-12 px-6 text-base">
        {againLabel}
      </button>
    </div>
  );
}
