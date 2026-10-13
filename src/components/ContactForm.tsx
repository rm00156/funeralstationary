"use client";

import { useEffect, useRef, useState } from "react";

import { Optional, Required, RequiredKey } from "@/components/FieldMarks";
import FormSent from "@/components/FormSent";
import TurnstileCheck from "@/components/TurnstileCheck";
import { focusFirstError } from "@/lib/focusFirstError";
import type { ContactField } from "@/lib/contact";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

const LABEL = "text-base font-semibold";

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
  /** Who it was from, for the thank-you once it has sent. */
  const [sentName, setSentName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  // Bumped on every refused send, so the effect below runs once the error
  // markup is on the page — then the visitor is taken to the first problem.
  const formRef = useRef<HTMLFormElement>(null);
  const [refusals, setRefusals] = useState(0);
  useEffect(() => {
    if (refusals > 0) focusFirstError(formRef.current);
  }, [refusals]);
  // Cloudflare Turnstile (TurnstileCheck): a token is spent by every send the
  // server checks, so the check starts again after each attempt.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const resetTurnstile = () => {
    setTurnstileToken(null);
    setTurnstileKey((key) => key + 1);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = { ...Object.fromEntries(new FormData(form)), turnstileToken };
    const name = String(new FormData(form).get("name") ?? "").trim();
    setState("sending");
    setError(null);
    setErrors({});
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      resetTurnstile();
      if (response.ok) {
        setSentName(name);
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
      resetTurnstile();
      setError("We couldn't send your message just now. Please check your connection and try again.");
    }
    setRefusals((count) => count + 1);
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

  if (state === "sent") {
    return (
      <FormSent title="Message sent" againLabel="Send another message" onAgain={() => setState("idle")}>
        <p>
          Thank you{sentName ? `, ${sentName}` : ""}. Your message has been sent, and we’ll reply as
          soon as we can during opening hours.
        </p>
      </FormSent>
    );
  }

  return (
    <form
      ref={formRef}
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
        <RequiredKey />
      </div>

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
            <Required />
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
            Phone <Optional />
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
          <Required />
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
            <Required />
          </label>
          <select
            id="c-topic"
            name="topic"
            defaultValue={initialTopic}
            required
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
            Date of the service <Optional>(optional, if known)</Optional>
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
          <Required />
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

      <TurnstileCheck resetKey={turnstileKey} onToken={setTurnstileToken} />

      <button
        type="submit"
        disabled={state === "sending" || !turnstileToken}
        className="btn btn-primary min-h-14 self-start px-8 text-lg"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
