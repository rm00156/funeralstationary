export default function Hero() {
  return (
    <section
      className="relative px-margin-mobile md:px-gutter overflow-hidden pt-16 pb-20 md:pt-32 md:pb-40"
      style={{
        backgroundImage:
          "url('https://lh3.googleusercontent.com/aida/AEtjO1X7-OsbbciDbnm9OQmVQtqgWt14osSLEWMp4nXjZ7yExFEP7snU-lshSxzhoo4HmYpB5bwcTHEWUr7DWBiMvK4LfqmZW8VLtTEIwm_35mtWjUW-bpqzoge96axPCJrfVc5_kbZYFRQYWcveu3zgnZUifXR_CPKQN65IrKFoNN978mF99WF7BMJ8OerpSRjs6tW5JLI3C-7eNxMSJap5E6KsGc3_AY8VbL8zfrsgbiGR90MfmkflTw0tdBU')",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 z-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary-fixed/40 via-background/80 to-background/90" />
      </div>

      <div className="max-w-[1200px] mx-auto relative z-10 text-center flex flex-col items-center">
        <div className="flex flex-col items-center gap-3 mb-10">
          <span className="text-primary-container font-medium tracking-[0.2em] uppercase text-sm">
            24hrs&ndash;72hrs Fast Turnaround
          </span>
          <span className="block w-64 max-w-full h-px bg-primary-container/70" />
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-semibold text-primary max-w-5xl mb-10 leading-tight">
          Personalise a tribute booklet in minutes,
          <br />
          <span className="text-on-surface">delivered next day.</span>
        </h1>

        <p className="font-body text-xl md:text-2xl text-on-surface-variant max-w-3xl mb-14">
          Bring your Canva designs to life. Fast turnaround for your most
          precious tributes, delivered with compassionate professionalism.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto mb-6">
          <a
            href="#templates"
            className="px-10 py-4 bg-primary-container text-white rounded-lg hover:bg-primary hover:scale-105 shadow-lg shadow-primary-container/30 transition-all duration-300 text-lg font-medium tracking-wide text-center"
          >
            Start your design
          </a>
          <a
            href="#how-it-works"
            className="px-10 py-4 bg-surface/80 border-2 border-primary-container text-primary-container rounded-lg hover:bg-surface-container transition-colors duration-300 text-lg font-medium tracking-wide text-center backdrop-blur-sm"
          >
            How It Works
          </a>
        </div>

        <p className="text-on-surface-variant underline cursor-pointer hover:text-primary transition-colors">
          Already have your own design? Upload it
        </p>
      </div>
    </section>
  );
}
