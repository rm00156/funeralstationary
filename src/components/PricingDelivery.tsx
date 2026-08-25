import Image from "next/image";
import { Printer, Truck } from "lucide-react";

export default function PricingDelivery() {
  return (
    <section
      id="pricing"
      className="py-section-gap px-margin-mobile md:px-gutter bg-surface"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-6">
              Professional Printing &amp; Fast Delivery
            </h2>
            <p className="font-body text-lg text-on-surface-variant mb-8">
              We understand that time is of the essence. That&rsquo;s why we
              offer swift turnarounds without compromising on our premium
              quality.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 bg-surface-container-low rounded-xl border border-outline-variant/30">
                <Printer className="text-primary shrink-0" size={32} />
                <div>
                  <h4 className="font-display text-xl text-on-surface mb-2">
                    Premium Quality
                  </h4>
                  <p className="font-body text-on-surface-variant">
                    Printed on high-quality, weighted paper ensuring a
                    lasting tribute. Available in the exact A5 mm size (148 x
                    210mm).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 bg-primary-container text-white rounded-xl shadow-md">
                <Truck className="shrink-0" size={32} />
                <div>
                  <h4 className="font-display text-xl mb-2">
                    Next Day Delivery (&pound;10)
                  </h4>
                  <p className="font-body text-primary-fixed">
                    Order before <strong>11am</strong> for next working day
                    delivery across the UK.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8 items-center justify-center">
            <div className="relative w-full max-w-xs aspect-square">
              <Image
                src="https://lh3.googleusercontent.com/aida/AEtjO1XG3QPJZS1qyzNTsc_hIhUT5WqIOAp0uJsdYJL3u8FWMS1VPR2YsQHqdPvPxXHLoDUS6SzUJEpTIQc-mdJFtHSzKW8VTV035QmY8XN_TMS0toD85KvZo_55gdLsU4F6LFJKR75AA4Qvke1o32YPectG1Q-h8elMYKdXxDr-UYlrjZW431oMhBjZRyzJn7xcl6RukCOx59A2lfSgIMDtyp07fNxYG3EBJHEhnHlUvZLDFggdcO3P8GAAUiw"
                alt="Professional Printing"
                fill
                sizes="320px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
