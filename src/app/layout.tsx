import type { Metadata } from "next";
import {
  Alegreya,
  Alex_Brush,
  Allura,
  Ballet,
  Cabin,
  Cardo,
  Cormorant,
  Cormorant_Garamond,
  Courgette,
  Dancing_Script,
  Domine,
  EB_Garamond,
  Great_Vibes,
  Herr_Von_Muellerhoff,
  Inter,
  Italianno,
  Josefin_Sans,
  Karla,
  Kristi,
  La_Belle_Aurore,
  Lato,
  League_Script,
  Libre_Baskerville,
  Lora,
  Marcellus,
  Marck_Script,
  Mea_Culpa,
  Meddon,
  Merriweather,
  Mrs_Saint_Delafield,
  Mulish,
  Nunito_Sans,
  PT_Serif,
  Parisienne,
  Petit_Formal_Script,
  Pinyon_Script,
  Playfair_Display,
  Prata,
  Quicksand,
  Raleway,
  Rouge_Script,
  Sacramento,
  Satisfy,
  Source_Serif_4,
  Spectral,
  Tangerine,
  Vollkorn,
  WindSong,
  Work_Sans,
  Yesteryear,
} from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Script face used by the design editor canvas (e.g. "Celebrating") — loaded
// site-wide so /proof-render renders it identically to /design when
// Puppeteer screenshots it for the print proof.
const greatVibes = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

// The rest of the design editor's font picker (see FONT_OPTIONS in
// designEditor.ts) — loaded site-wide for the same proof-render pixel-fidelity
// reason as greatVibes above. Grouped to match FONT_OPTIONS' serif / sans /
// script ordering; each `weight` list is only what next/font's Google Fonts
// metadata reports as available for that family. next/font's compiler plugin
// requires each loader call assigned directly to its own top-level const —
// it can't be called inline inside an array/object literal.

// Serif / display
const playfairDisplay = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400", "600"] });
const cormorantGaramond = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["400", "600"] });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], weight: ["400", "600"] });
const ebGaramond = EB_Garamond({ variable: "--font-eb-garamond", subsets: ["latin"], weight: ["400", "600"] });
const cormorantAlt = Cormorant({ variable: "--font-cormorant-alt", subsets: ["latin"], weight: ["400", "600"] });
const libreBaskerville = Libre_Baskerville({ variable: "--font-libre-baskerville", subsets: ["latin"], weight: ["400", "600"] });
const marcellus = Marcellus({ variable: "--font-marcellus", subsets: ["latin"], weight: ["400"] });
const prata = Prata({ variable: "--font-prata", subsets: ["latin"], weight: ["400"] });
const spectral = Spectral({ variable: "--font-spectral", subsets: ["latin"], weight: ["400", "600"] });
const vollkorn = Vollkorn({ variable: "--font-vollkorn", subsets: ["latin"], weight: ["400", "600"] });
const domine = Domine({ variable: "--font-domine", subsets: ["latin"], weight: ["400", "600"] });
const ptSerif = PT_Serif({ variable: "--font-pt-serif", subsets: ["latin"], weight: ["400", "700"] });
const merriweather = Merriweather({ variable: "--font-merriweather", subsets: ["latin"], weight: ["400", "600"] });
const cardo = Cardo({ variable: "--font-cardo", subsets: ["latin"], weight: ["400", "700"] });
const alegreya = Alegreya({ variable: "--font-alegreya", subsets: ["latin"], weight: ["400", "600"] });

// Sans body
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600"] });
const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700"] });
const karla = Karla({ variable: "--font-karla", subsets: ["latin"], weight: ["400", "600"] });
const nunitoSans = Nunito_Sans({ variable: "--font-nunito-sans", subsets: ["latin"], weight: ["400", "600"] });
const raleway = Raleway({ variable: "--font-raleway", subsets: ["latin"], weight: ["400", "600"] });
const josefinSans = Josefin_Sans({ variable: "--font-josefin-sans", subsets: ["latin"], weight: ["400", "600"] });
const cabin = Cabin({ variable: "--font-cabin", subsets: ["latin"], weight: ["400", "600"] });
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"], weight: ["400", "600"] });
const mulish = Mulish({ variable: "--font-mulish", subsets: ["latin"], weight: ["400", "600"] });

// Script / decorative
const dancingScript = Dancing_Script({ variable: "--font-dancing", subsets: ["latin"], weight: ["400", "600"] });
const alexBrush = Alex_Brush({ variable: "--font-alex-brush", subsets: ["latin"], weight: ["400"] });
const tangerine = Tangerine({ variable: "--font-tangerine", subsets: ["latin"], weight: ["400", "700"] });
const sacramento = Sacramento({ variable: "--font-sacramento", subsets: ["latin"], weight: ["400"] });
const parisienne = Parisienne({ variable: "--font-parisienne", subsets: ["latin"], weight: ["400"] });
const allura = Allura({ variable: "--font-allura", subsets: ["latin"], weight: ["400"] });
const petitFormalScript = Petit_Formal_Script({ variable: "--font-petit-formal-script", subsets: ["latin"], weight: ["400"] });
const mrsSaintDelafield = Mrs_Saint_Delafield({ variable: "--font-mrs-saint-delafield", subsets: ["latin"], weight: ["400"] });
const pinyonScript = Pinyon_Script({ variable: "--font-pinyon-script", subsets: ["latin"], weight: ["400"] });
const italianno = Italianno({ variable: "--font-italianno", subsets: ["latin"], weight: ["400"] });
const meddon = Meddon({ variable: "--font-meddon", subsets: ["latin"], weight: ["400"] });
const herrVonMuellerhoff = Herr_Von_Muellerhoff({ variable: "--font-herr-von-muellerhoff", subsets: ["latin"], weight: ["400"] });
const meaCulpa = Mea_Culpa({ variable: "--font-mea-culpa", subsets: ["latin"], weight: ["400"] });
const windsong = WindSong({ variable: "--font-windsong", subsets: ["latin"], weight: ["400", "500"] });
const marckScript = Marck_Script({ variable: "--font-marck-script", subsets: ["latin"], weight: ["400"] });
const yesteryear = Yesteryear({ variable: "--font-yesteryear", subsets: ["latin"], weight: ["400"] });
const leagueScript = League_Script({ variable: "--font-league-script", subsets: ["latin"], weight: ["400"] });
const rougeScript = Rouge_Script({ variable: "--font-rouge-script", subsets: ["latin"], weight: ["400"] });
const ballet = Ballet({ variable: "--font-ballet", subsets: ["latin"], weight: ["400"] });
const laBelleAurore = La_Belle_Aurore({ variable: "--font-la-belle-aurore", subsets: ["latin"], weight: ["400"] });
const courgette = Courgette({ variable: "--font-courgette", subsets: ["latin"], weight: ["400"] });
const satisfy = Satisfy({ variable: "--font-satisfy", subsets: ["latin"], weight: ["400"] });
const kristi = Kristi({ variable: "--font-kristi", subsets: ["latin"], weight: ["400"] });

const editorFonts = [
  playfairDisplay,
  cormorantGaramond,
  lora,
  ebGaramond,
  cormorantAlt,
  libreBaskerville,
  marcellus,
  prata,
  spectral,
  vollkorn,
  domine,
  ptSerif,
  merriweather,
  cardo,
  alegreya,
  inter,
  lato,
  karla,
  nunitoSans,
  raleway,
  josefinSans,
  cabin,
  quicksand,
  mulish,
  dancingScript,
  alexBrush,
  tangerine,
  sacramento,
  parisienne,
  allura,
  petitFormalScript,
  mrsSaintDelafield,
  pinyonScript,
  italianno,
  meddon,
  herrVonMuellerhoff,
  meaCulpa,
  windsong,
  marckScript,
  yesteryear,
  leagueScript,
  rougeScript,
  ballet,
  laBelleAurore,
  courgette,
  satisfy,
  kristi,
];

export const metadata: Metadata = {
  title: "The Funeral Stationery | You design the tribute. We print the memories.",
  description:
    "Personalise a tribute booklet in minutes, delivered next day. Fast turnaround for your most precious tributes, delivered with compassionate professionalism.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fontVariables = [sourceSerif, workSans, greatVibes, ...editorFonts]
    .map((font) => font.variable)
    .join(" ");

  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container">
        {children}
      </body>
    </html>
  );
}
