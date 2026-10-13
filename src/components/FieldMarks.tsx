/**
 * How the public forms (contact, trade application) mark their fields: a plum
 * asterisk on every required one, "(optional)" on the rest, and one line at
 * the top saying what the asterisk means — so nobody has to guess, and
 * nobody finds out only when Send is refused.
 *
 * The asterisk is hidden from screen readers: the input's own `required`
 * attribute is what they announce, and "Business name star" helps no one.
 */
export function Required() {
  return (
    <span aria-hidden className="ml-0.5 font-semibold text-plum">
      *
    </span>
  );
}

export function Optional({ children = "(optional)" }: { children?: React.ReactNode }) {
  return <span className="font-normal text-ink-3">{children}</span>;
}

/** The key, under the form's heading. */
export function RequiredKey() {
  return (
    <p className="text-[15px] text-ink-3">
      Fields marked <span className="font-semibold text-plum">*</span> are required.
    </p>
  );
}
