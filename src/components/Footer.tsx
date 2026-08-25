import Image from "next/image";

const LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms & Conditions", href: "#" },
  { label: "Price Guide", href: "#" },
  { label: "FAQs", href: "#" },
  { label: "Resources", href: "#" },
];

export default function Footer() {
  return (
    <footer
      id="contact"
      className="bg-surface-container-high py-section-gap px-margin-mobile md:px-gutter mt-auto"
    >
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-gutter">
        <div className="col-span-1 md:col-span-1">
          <Image
            src="/logo.webp"
            alt="The Funeral Stationery"
            width={564}
            height={120}
            className="h-10 w-auto object-contain mb-6 grayscale opacity-80"
          />
          <p className="text-on-surface-variant mb-6">
            Compassionate professionalism for your most precious tributes.
          </p>
          <p className="text-on-surface-variant font-bold">
            020 7277 7663
            <br />
            info@thefuneralstationery.co.uk
          </p>
        </div>

        <div>
          <h4 className="font-display text-lg mb-4 text-primary">Links</h4>
          <ul className="space-y-3">
            {LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-on-surface-variant hover:text-primary underline transition-all"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto mt-12 pt-8 border-t border-outline-variant/30 text-center">
        <p className="text-on-surface-variant text-sm">
          &copy; {new Date().getFullYear()} The Funeral Stationery. All
          rights reserved.
        </p>
      </div>
    </footer>
  );
}
