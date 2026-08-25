import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    title: "Excellent service from start to finish",
    body: "The quality of the Order of Service was outstanding and delivered exactly when promised. Highly recommended during such a difficult time.",
    initials: "SP",
    name: "Sarah Pat",
  },
  {
    title: "Very compassionate and professional",
    body: "The templates were easy to use, and the final print quality exceeded our expectations. A beautiful tribute for our loved one.",
    initials: "AK",
    name: "Alastair Kenward",
  },
];

export default function Testimonials() {
  return (
    <section className="py-section-gap px-margin-mobile md:px-gutter bg-surface-container-low">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-4">
            What Our Customers Say
          </h2>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto">
            Read how we&rsquo;ve helped families create beautiful final
            tributes.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Star className="text-secondary fill-secondary" size={24} />
            <span className="font-bold text-xl text-on-surface">4.9</span>
            <span className="text-on-surface-variant">
              / 5 based on 164 reviews
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-surface p-8 rounded-2xl shadow-sm border border-outline-variant/20 ambient-shadow flex flex-col h-full"
            >
              <div className="flex text-secondary mb-4 gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="fill-secondary" size={20} />
                ))}
              </div>
              <h4 className="font-display text-xl text-on-surface mb-2 font-bold">
                &ldquo;{testimonial.title}&rdquo;
              </h4>
              <p className="font-body text-on-surface-variant grow mb-6">
                {testimonial.body}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="text-sm text-on-surface font-semibold">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Verified Buyer
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
