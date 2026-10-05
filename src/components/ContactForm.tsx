"use client";

import { useState } from "react";

import type { ContactField } from "@/lib/contact";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

const LABEL = "text-base font-semibold";
const OPTIONAL = "font-normal text-ink-3";

/**
 * The /contact form. Posts JSON to /api/contact, which validates and emails
 * the message; field errors come back keyed by field and are announced beside
 * the input they belong to. Success replaces nothing — the confirmation
 * appears above the cleared form with role="status".
 */
export default function ContactForm({
  topics,
  initialTopic,
}: {
  /** Every topic the select offers: sellable products, then the fixed ones. */
  topics: { id: string; label: string }[];
  initialTopic: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setState("sending");
    setError(null);
    setErrors({});
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        form.reset();
        setState("sent");
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        errors?: Partial<Record<ContactField, string>>;
      } | null;
      setErrors(body?.errors ?? {});
      setError(body?.error ?? "We couldn't send your message just now. Please try again.");
    } catch {
      setError("We couldn't send your message just now. Please check your connection and try again.");
    }
    setState("idle");
  };

  const describe = (field: ContactField) =>
    errors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `c-${field}-error` }
      : {};
  const fieldError = (field: ContactField) =>
    errors[field] && (
      <p id={`c-${field}-error`} className="text-[15px] font-medium text-plum">
        {errors[field]}
      </p>
    );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-[22px] rounded-2xl border border-line bg-surface p-7 sm:p-11"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[32px] font-normal leading-[1.15] text-ink">
          Send us a message
        </h2>
        <p className="text-base text-ink-2">
          We’ll reply as soon as we can during opening hours.
        </p>
      </div>

      {state === "sent" && (
        <div
          role="status"
          className="rounded-lg border border-success-border bg-success-bg px-[18px] py-4 text-base text-success-text"
        >
          Thank you. Your message has been sent and we’ll be in touch soon.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-line-2 bg-mist-2 px-[18px] py-4 text-base text-ink"
        >
          {error} You can always reach us on{" "}
          <a href={PHONE_HREF} className="link font-semibold">
            {PHONE_DISPLAY}
          </a>
          .
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-name" className={LABEL}>
            Your name
          </label>
          <input
            id="c-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className="field"
            {...describe("name")}
          />
          {fieldError("name")}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-phone" className={LABEL}>
            Phone <span className={OPTIONAL}>(optional)</span>
          </label>
          <input
            id="c-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="field"
            {...describe("phone")}
          />
          {fieldError("phone")}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-email" className={LABEL}>
          Email
        </label>
        <input
          id="c-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field"
          {...describe("email")}
        />
        {fieldError("email")}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-topic" className={LABEL}>
            What’s it about?
          </label>
          <select
            id="c-topic"
            name="topic"
            defaultValue={initialTopic}
            className="field"
            {...describe("topic")}
          >
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.label}
              </option>
            ))}
          </select>
          {fieldError("topic")}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-date" className={LABEL}>
            Date of the service <span className={OPTIONAL}>(if known)</span>
          </label>
          <input
            id="c-date"
            name="serviceDate"
            type="date"
            className="field"
            {...describe("serviceDate")}
          />
          {fieldError("serviceDate")}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-message" className={LABEL}>
          Your message
        </label>
        <textarea
          id="c-message"
          name="message"
          rows={6}
          required
          className="field resize-y"
          {...describe("message")}
        />
        {fieldError("message")}
      </div>

      {/* Honeypot — hidden from people and assistive tech; see /api/contact. */}
      <div aria-hidden className="hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        type="submit"
        disabled={state === "sending"}
        className="btn btn-primary min-h-14 self-start px-8 text-lg"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
