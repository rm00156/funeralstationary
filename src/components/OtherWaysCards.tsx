import Link from "next/link";
import { ArrowRight, PenLine, Upload } from "lucide-react";

import { DESIGN_FOR_YOU_HREF, UPLOAD_DESIGN_HREF } from "@/lib/site";

/**
 * The two ways to order that aren't a catalogue product: the dark "We design
 * it for you" card and the dashed "Upload your own design" card. Both are
 * handled by a person, so they lead to the contact page. `tall` is the
 * product-grid shape (shop, home); the default is the compact row under a
 * product's designs. Rendered as two siblings so they drop into any grid.
 */
export function DesignForYouCard({ tall = false }: { tall?: boolean }) {
  if (!tall) {
    return (
      <Link
        href={DESIGN_FOR_YOU_HREF}
        className="flex gap-5 rounded-xl bg-plum-deep p-8 text-white no-underline transition-colors hover:bg-plum-night"
      >
        <PenLine size={32} strokeWidth={1.5} aria-hidden className="shrink-0 text-on-plum-muted" />
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-2xl font-medium">We design it for you</h3>
          <p className="text-base text-on-plum">
            Send us the photos and words and we’ll put it together for you.
          </p>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={DESIGN_FOR_YOU_HREF}
      className="flex min-h-[380px] flex-col justify-between gap-6 rounded-xl bg-plum-deep px-7 pb-7 pt-8 text-white no-underline transition-colors hover:bg-plum-night"
    >
      <div className="flex flex-col gap-3.5">
        <PenLine size={36} strokeWidth={1.5} aria-hidden className="text-on-plum-muted" />
        <p className="eyebrow text-on-plum-muted">Other ways to order</p>
        <h3 className="font-display text-[26px] font-medium leading-[1.2]">
          We design it for you
        </h3>
        <p className="text-base text-on-plum">
          Don’t have the time or energy to design it yourself? Send us the photos and words and
          we’ll put it together for you.
        </p>
      </div>
      <span className="flex items-center gap-2 text-base font-medium">
        Talk to us <ArrowRight size={18} aria-hidden />
      </span>
    </Link>
  );
}

export function UploadDesignCard({ tall = false }: { tall?: boolean }) {
  if (!tall) {
    return (
      <Link
        href={UPLOAD_DESIGN_HREF}
        className="flex gap-5 rounded-xl border-[1.5px] border-dashed border-field-border bg-surface p-8 no-underline transition-colors hover:border-plum"
      >
        <Upload size={32} strokeWidth={1.5} aria-hidden className="shrink-0 text-plum" />
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-2xl font-medium text-ink">Upload your own design</h3>
          <p className="text-base text-ink-2">
            Made it in Canva? Send it to us and we’ll print and deliver it.
          </p>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={UPLOAD_DESIGN_HREF}
      className="flex min-h-[380px] flex-col justify-between gap-6 rounded-xl border-[1.5px] border-dashed border-field-border bg-surface px-7 pb-7 pt-8 no-underline transition-colors hover:border-plum"
    >
      <div className="flex flex-col gap-3.5">
        <Upload size={36} strokeWidth={1.5} aria-hidden className="text-plum" />
        <p className="eyebrow">Other ways to order</p>
        <h3 className="font-display text-[26px] font-medium leading-[1.2] text-ink">
          Upload your own design
        </h3>
        <p className="text-base text-ink-2">
          Made it in Canva? Send us your finished design and we’ll print and deliver it.
        </p>
      </div>
      <span className="flex items-center gap-2 text-base font-medium text-plum">
        Send us your design <ArrowRight size={18} aria-hidden />
      </span>
    </Link>
  );
}
