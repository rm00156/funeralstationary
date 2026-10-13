"use client";

import { useEffect, useRef, useState } from "react";

import { Optional, Required, RequiredKey } from "@/components/FieldMarks";
import FormSent from "@/components/FormSent";
import TurnstileCheck from "@/components/TurnstileCheck";
import { focusFirstError } from "@/lib/focusFirstError";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";
import { FUNERAL_VOLUMES, TRADE_ROLES, type TradeChoice, type TradeField } from "@/lib/tradeApplication";

const LABEL = "text-base font-semibold";
const GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-5";

/**
 * The /trade application. Posts JSON to /api/trade, which validates and
 * emails it to the business; field errors come back keyed by field and are
 * announced beside the input they belong to, as on the contact form.
 */
export default function TradeApplicationForm({ orderTypes }: { orderTypes: TradeChoice[] }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  /** The role chosen; "other" shows a box for their own words. */
  const [role, setRole] = useState("");
  /** Who applied, for the thank-you once it has sent. */
  const [sentName, setSentName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<TradeField, string>>>({});
  // Bumped on every refused send, so the effect below runs once the error
  // markup is on the page — then the visitor is taken to the first problem.
  const formRef = useRef<HTMLFormElement>(null);
  const [refusals, setRefusals] = useState(0);
  useEffect(() => {
    if (refusals > 0) focusFirstError(formRef.current);
  }, [refusals]);
  // Cloudflare Turnstile, as on the contact form: a fresh check after each attempt.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const resetTurnstile = () => {
    setTurnstileToken(null);
    setTurnstileKey((key) => key + 1);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    // Object.fromEntries would keep only the last ticked box.
    const data = { ...Object.fromEntries(formData), orders: formData.getAll("orders"), turnstileToken };
    const name = String(formData.get("name") ?? "").trim();
    setState("sending");
    setError(null);
    setErrors({});
    try {
      const response = await fetch("/api/trade", {
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
        errors?: Partial<Record<TradeField, string>>;
      } | null;
      setErrors(body?.errors ?? {});
      setError(body?.error ?? "We couldn't send your application just now. Please try again.");
    } catch {
      resetTurnstile();
      setError(
        "We couldn't send your application just now. Please check your connection and try again.",
      );
    }
    setRefusals((count) => count + 1);
    setState("idle");
  };

  const describe = (field: TradeField) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `t-${field}-error` } : {};
  const fieldError = (field: TradeField) =>
    errors[field] && (
      <p id={`t-${field}-error`} className="text-[15px] font-medium text-plum">
        {errors[field]}
      </p>
    );

  const input = (
    field: TradeField,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`t-${field}`} className={LABEL}>
        {label}
        <Required />
      </label>
      <input
        id={`t-${field}`}
        name={field}
        type="text"
        required
        className="field"
        {...props}
        {...describe(field)}
      />
      {fieldError(field)}
    </div>
  );

  if (state === "sent") {
    return (
      <FormSent
        title="Application sent"
        againLabel="Send another application"
        onAgain={() => {
          setRole("");
          setState("idle");
        }}
      >
        <p>
          Thank you{sentName ? `, ${sentName}` : ""}. We’ve received your application and we’ll be in
          touch to set up your account.
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
        <h2 className="type-sub">Apply for a trade account</h2>
        <p className="text-base text-ink-2">
          For funeral directors and others ordering on behalf of families.
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

      <div className={GRID}>
        {input("businessName", "Business name", { autoComplete: "organization" })}
        {input("postcode", "Postcode", { autoComplete: "postal-code" })}
      </div>
      <div className={GRID}>
        {input("name", "Your name", { autoComplete: "name" })}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="t-role" className={LABEL}>
            Your role
            <Required />
          </label>
          <select
            id="t-role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            required
            className="field"
            {...describe("role")}
          >
            <option value="" disabled>
              Choose your role
            </option>
            {TRADE_ROLES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldError("role")}
          {role === "other" && (
            <div className="mt-2 flex flex-col gap-1.5">
              <label htmlFor="t-roleOther" className={LABEL}>
                Tell us your role
                <Required />
              </label>
              <input
                id="t-roleOther"
                name="roleOther"
                type="text"
                autoComplete="organization-title"
                maxLength={120}
                required
                className="field"
                {...describe("roleOther")}
              />
              {fieldError("roleOther")}
            </div>
          )}
        </div>
      </div>
      <div className={GRID}>
        {input("email", "Email", { type: "email", autoComplete: "email" })}
        {input("phone", "Phone", { type: "tel", autoComplete: "tel" })}
      </div>

      <div className={GRID}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="t-volume" className={LABEL}>
            Roughly how many funerals a month?
            <Required />
          </label>
          <select
            id="t-volume"
            name="volume"
            defaultValue={FUNERAL_VOLUMES[0].id}
            required
            className="field"
            {...describe("volume")}
          >
            {FUNERAL_VOLUMES.map((volume) => (
              <option key={volume.id} value={volume.id}>
                {volume.label}
              </option>
            ))}
          </select>
          {fieldError("volume")}
        </div>
      </div>

      <fieldset
        className="flex flex-col gap-2.5"
        aria-describedby={errors.orders ? "t-orders-error" : undefined}
      >
        <legend className={`mb-2.5 ${LABEL}`}>
          What do you usually order? <Optional />
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {orderTypes.map((type) => (
            <label
              key={type.id}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border-[1.5px] border-line-2 bg-surface px-3.5 text-base transition-colors hover:border-plum has-checked:border-plum has-checked:bg-mist-2"
            >
              <input
                type="checkbox"
                name="orders"
                value={type.id}
                className="size-[18px] shrink-0 accent-plum"
              />
              {type.label}
            </label>
          ))}
        </div>
        {fieldError("orders")}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="t-notes" className={LABEL}>
          Anything else we should know? <Optional />
        </label>
        <textarea
          id="t-notes"
          name="notes"
          rows={4}
          className="field resize-y"
          {...describe("notes")}
        />
        {fieldError("notes")}
      </div>

      {/* Honeypot — hidden from people and assistive tech; see /api/trade. */}
      <div aria-hidden className="hidden">
        <label htmlFor="t-website">Website</label>
        <input id="t-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <TurnstileCheck resetKey={turnstileKey} onToken={setTurnstileToken} />

      <button
        type="submit"
        disabled={state === "sending" || !turnstileToken}
        className="btn btn-primary min-h-14 self-start px-8 text-lg"
      >
        {state === "sending" ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
