import Image from "next/image";
import { FileText } from "lucide-react";

/**
 * An order line's thumbnail: its template's preview, or a plain sheet for
 * uploaded artwork (the customer's own PDF has no preview on the customer
 * path — proofs are a press artefact).
 */
export default function OrderThumb({
  src,
  className = "h-[88px] w-[64px]",
  sizes = "64px",
}: {
  src: string | null;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-sheet ${className}`}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <FileText size={22} strokeWidth={1.5} aria-hidden className="text-ink-label" />
      )}
    </div>
  );
}
