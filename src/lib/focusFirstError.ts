/**
 * After a form's send is refused, take the visitor to what needs fixing: the
 * first field marked `aria-invalid`, in page order, scrolled to the middle of
 * the screen and focused — or, when no field is at fault (the mail provider
 * is down, the Turnstile check failed), the form's `role="alert"` message.
 * Without this, a long form like the trade application leaves the message
 * scrolled out of sight above the button that was clicked.
 *
 * Returns what it went to, or null when there was nothing to show.
 */
export function focusFirstError(form: HTMLElement | null): HTMLElement | null {
  if (!form) return null;
  const field = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  const target = field ?? form.querySelector<HTMLElement>('[role="alert"]');
  if (!target) return null;
  reveal(target, { focus: target === field });
  return target;
}

/**
 * Scroll an element to the middle of the screen (without animation for anyone
 * who asks for reduced motion) and optionally focus it. `focus` moves the
 * keyboard and a screen reader's place there too — a field so they can type
 * straight away, or a sent form's confirmation panel (tabIndex -1).
 */
export function reveal(target: HTMLElement, { focus = false }: { focus?: boolean } = {}): void {
  const reduceMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  if (focus) target.focus({ preventScroll: true });
}
