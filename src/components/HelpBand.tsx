import { Phone } from "lucide-react";

import {
  ADDRESS_TOWN,
  EMAIL_HREF,
  OPENING_HOURS_LONG,
  PHONE_DISPLAY,
  PHONE_HREF,
} from "@/lib/site";

/**
 * The plum call-to-action panel that closes a page. With no props it is the
 * "Not sure where to start?" help band; the reviews page passes its own
 * wording and actions.
 */
export default function HelpBand({
  title = "Not sure where to start? We’re here to help.",
  body = `Talk to us about designs, wording or timings, ${OPENING_HOURS_LONG}. You’re also welcome to visit us in ${ADDRESS_TOWN} – just call ahead to book a time.`,
  children,
}: {
  title?: string;
  body?: string;
  /** The buttons. Defaults to the phone number and "Email us". */
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-paper px-margin-mobile pb-24 sm:px-gutter">
      <div className="mx-auto flex max-w-[1136px] flex-wrap items-center justify-between gap-x-12 gap-y-8 rounded-2xl bg-plum px-7 py-12 text-white sm:px-14 sm:py-16">
        <div className="flex max-w-[560px] flex-col gap-3">
          <h2 className="font-display text-[clamp(30px,3vw,40px)] font-normal leading-[1.15] text-balance">
            {title}
          </h2>
          <p className="text-on-plum">{body}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          {children ?? (
            <>
              <a href={PHONE_HREF} className="btn btn-on-dark min-h-14 text-lg">
                <Phone size={18} strokeWidth={1.8} aria-hidden />
                {PHONE_DISPLAY}
              </a>
              <a href={EMAIL_HREF} className="btn btn-on-dark-outline min-h-14 text-lg">
                Email us
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
