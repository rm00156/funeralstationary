const STEPS = [
  {
    number: 1,
    title: "Register",
    description:
      "Create an account to save your designs and track your orders. Your design saves automatically as you go — come back anytime.",
  },
  {
    number: 2,
    title: "Choose Design",
    description:
      "Select from our beautiful templates or use your own Canva design.",
  },
  {
    number: 3,
    title: "Personalise",
    description:
      "Add photos, text, and special touches to create a unique tribute.",
  },
  {
    number: 4,
    title: "Print & Deliver",
    description: "We print on premium paper and deliver quickly with care.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-section-gap px-margin-mobile md:px-gutter bg-surface-container-low"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-4">
            How It Works
          </h2>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto">
            A simple, stress-free process to create beautiful memorials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          <div className="hidden md:block absolute top-10 left-0 w-full h-0.5 bg-primary-fixed -z-10" />

          {STEPS.map((step) => (
            <div key={step.number} className="text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-primary-container text-white flex items-center justify-center text-2xl font-bold mb-6 shadow-lg z-10">
                {step.number}
              </div>
              <h3 className="font-display text-xl text-on-surface mb-3">
                {step.title}
              </h3>
              <p className="font-body text-on-surface-variant">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
