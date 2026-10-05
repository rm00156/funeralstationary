import Image from "next/image";
import { Clock, FileText, Truck } from "lucide-react";

import { sizeRangeText, sizeText, type ProductFormat } from "@/lib/designEditor";
import { formatPence, type DeliveryOption } from "@/lib/orderOfServicePricing";
import { STANDARD_TURNAROUND } from "@/lib/site";

/**
 * "Printed properly, delivered on time". The delivery rows are the lead
 * product's own delivery options — label, price and note straight from its
 * pricing table — so this section can't quote a price the basket won't charge.
 * The size line is the lead product's format, for the same reason.
 */
export default function QualityDelivery({
  delivery,
  format,
}: {
  delivery: DeliveryOption[];
  format: ProductFormat | null;
}) {
  const rows = [
    {
      icon: FileText,
      title: "Heavyweight paper",
      body: !format
        ? "Printed to be kept."
        : format.sizedByOption
          ? `Printed at the size you choose, ${sizeRangeText(format)}, made to be kept.`
          : `Exact ${sizeText(format)}, made to be kept.`,
    },
    ...delivery.map((option) => ({
      icon: Truck,
      title: `${option.label}, ${option.pricePence === 0 ? "free" : formatPence(option.pricePence)}`,
      body: option.note,
    })),
    {
      icon: Clock,
      title: `Standard turnaround ${STANDARD_TURNAROUND}`,
      body: "If your service date is close, call us and we’ll tell you exactly what’s possible.",
    },
  ];

  return (
    <section className="bg-mist">
      <div className="site-container grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-center gap-16 py-20 md:py-24">
        <div className="relative mx-auto aspect-[3/2] w-full overflow-hidden rounded-[16px] shadow-cover-lg">
          <Image
            src="/printed-booklet.jpg"
            alt="A stack of printed order of service booklets on a table beside a vase of flowers"
            fill
            sizes="(min-width: 1024px) 560px, 90vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="type-section">Printed properly, delivered on time</h2>
            <p className="text-ink-2">
              We know time is short. We turn orders round quickly without cutting corners on
              quality.
            </p>
          </div>
          <dl className="flex flex-col border-b border-line-2">
            {rows.map((row) => (
              <div key={row.title} className="flex gap-5 border-t border-line-2 py-5">
                <row.icon size={28} strokeWidth={1.6} aria-hidden className="shrink-0 text-plum" />
                <div className="flex flex-col gap-0.5">
                  <dt className="font-semibold">{row.title}</dt>
                  <dd className="text-ink-2">{row.body}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
