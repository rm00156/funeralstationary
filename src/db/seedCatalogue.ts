/**
 * Seed-only bootstrap data for the catalogue and pricing tables.
 *
 * This is NOT runtime configuration. The live site reads the catalogue from
 * MySQL via src/lib/catalogue.server.ts / src/lib/pricing.server.ts, and the
 * admin area edits it in place — these arrays exist only so `npm run db:seed`
 * can populate an empty database. Rates are in pounds here (matching the
 * original placeholder price list) and converted to pence by seedData.ts.
 *
 * PLACEHOLDER RATES — the order of service is calibrated so the known
 * real-world quote (15 copies / A5 / 4 page / Silk = £33.00) comes out exact,
 * then extrapolated linearly. The cards, bookmarks and memory board are
 * guesses for the owner to replace in /admin.
 *
 * PLACEHOLDER ARTWORK — every template points at one of the Stitch export
 * images already used elsewhere on the site.
 */

import type { ProductFormatRow } from "@/lib/designEditor";
import type { ProductOccasion } from "@/lib/templates";

/** A flat A6 card printed on both sides — memorial and thank-you cards. */
const CARD_A6: ProductFormatRow = {
  sizeLabel: "A6",
  trimWidthMm: 105,
  trimHeightMm: 148,
  templatePages: 2,
  sizedByOption: false,
  paperLabel: "Paper",
};

interface SeedOption {
  id: string;
  label: string;
  multiplier: number;
  note?: string;
}

/**
 * `description` is the card blurb on the shop and home pages (draft copy from
 * the redesign handoff — the owner still has to approve it); `occasion` is
 * which shop group the product sits in; `format` is its size and page
 * structure (ProductFormat), absent for the A5 booklet's defaults.
 */
export const PRODUCTS: {
  id: string;
  label: string;
  description: string;
  occasion: ProductOccasion;
  format?: ProductFormatRow;
}[] = [
  {
    id: "order-of-service",
    label: "Order of Service Booklets",
    description:
      "Personalise online with their photographs and words. Printed at exact A5, 148 × 210 mm.",
    occasion: "service",
  },
  {
    id: "memorial-cards",
    label: "Memorial Cards",
    description:
      "A6 cards with their photo and dates on the front and a verse on the back, for family and friends to keep.",
    occasion: "service",
    format: CARD_A6,
  },
  {
    id: "bookmarks",
    label: "Bookmarks",
    description:
      "A small keepsake with their photo and a favourite verse, to give out on the day.",
    occasion: "service",
    format: {
      sizeLabel: "50 × 200 mm",
      trimWidthMm: 50,
      trimHeightMm: 200,
      templatePages: 2,
      sizedByOption: false,
      paperLabel: "Paper",
    },
  },
  {
    id: "memory-board",
    label: "Memory Board",
    description:
      "A picture board of their life for the entrance or the wake, from A4 up to A0, mounted with an easel if you need one.",
    occasion: "service",
    // One A-series design, printed at whichever size is chosen (the
    // page-count options below are the sizes). Drawn at A4.
    format: {
      sizeLabel: "A4 to A0",
      trimWidthMm: 210,
      trimHeightMm: 297,
      templatePages: 1,
      sizedByOption: true,
      paperLabel: "Finish",
    },
  },
  {
    id: "thank-you-cards",
    label: "Thank You Cards",
    description: "Thank everyone who sent flowers, cards or kind words, in your own words.",
    occasion: "after",
    format: CARD_A6,
  },
  {
    id: "pet-sympathy",
    label: "Pet Sympathy Cards",
    description: "For a much-loved companion, or to send to someone who has lost theirs.",
    occasion: "after",
  },
];

export const DEFAULT_PRODUCT = PRODUCTS[0].id;

export const CATEGORIES = [
  { id: "birds", label: "Birds" },
  { id: "calm", label: "Calm" },
  { id: "classic", label: "Classic" },
  { id: "colourful", label: "Colourful" },
  { id: "floral", label: "Floral" },
  { id: "military", label: "Military and Police" },
  { id: "minimalistic", label: "Minimalistic" },
  { id: "modern", label: "Modern" },
  { id: "nature", label: "Nature" },
  { id: "religious", label: "Religious" },
  { id: "simple", label: "Simple" },
  { id: "sport", label: "Sports and Hobbies" },
];

const ARTWORK = {
  floral:
    "https://lh3.googleusercontent.com/aida/AEtjO1XqBO5jCj3jWJCsF_gzJxW5VTOB3Ha-R84QTsA7Niioyk4p5qo45fBJZ9oXdHCCfkBqLbw2GZ52O_SO-fKCo2MLVi2bpJN5FEYT4Db30bES1DOD9dN9Qukcm6GhlfT75ZNd4BMkrL4ryrbJehSMqfaJmMNzP1HzEc2B46m93IagiYQGf4nwQy8kT5P6WDeIsJU3yYGuB5M_vkmuL3mBsc4poWN9MW_JeAz6QRU6VImktNK5OdTNSWpc9C5F",
  themes:
    "https://lh3.googleusercontent.com/aida/AEtjO1VOOoXItMXQIpHmmzRXFehnOsKeeEb0NqG83BsJGvSIb31faAFaBKgFv6k1Rv5148dOSPJrjEqHWIX25RdafO_WNC-hScUKEONqdOVC4J5s_eGouqUEIPVftcg48qubsdzkoRLDJlUM-Qr0Rz3uMvv6std5jCApjrheqlQ4Dv1-x2OkVpts9YP6FiQbkTpeitNZcBTC-3LT2tsYlwqVC9BBj0czLbnF9zEeWr6re6Aa-Pq8k-6UXdZYggA",
  classic:
    "https://lh3.googleusercontent.com/aida/AEtjO1UZ-qKw2zOQhr6QfvfFb6-r7WRdHlE5U6j6qJ4Jxt5AXS6AttERQGRnTr-bQ31v31ImAw5oTaLC7K1q50_udIDPuwWb447CYNK9zlP7V_wVKYQ5AGIvyLv-zU8qO0IMYTggeWp-DjGBVk_FCW-Bdr-c_7QPoDeXB_L4DRQ_JrtH6vGb4PZ2iVqU5XghErR0rG9B4IsvrIiLvwOtZc9VoEkpyMQ6BttDshSqfHGFKCVdbTPGBuyZVYDiJluA",
  religious:
    "https://lh3.googleusercontent.com/aida/AEtjO1VwVfmZTjX4wVvrv01kzxYvhW_KOmKM2p7EUf3dt2vFmlvm51OsOzhhEABnQ6cVW85PyYCTGg_tazz608tlvuri8rja7f7Vakmi2bQPeUeHNXwJYdh3BM1FNRxrcNEHQD9tLIrWFRWN3-sSFEK2JyTm-_QVvkJ19KErZeBxX57Xl1_LmB56c-tcLF-_fWX1FFjU2TfX-vdts5yZILBYzXna5Sw18--WcTsVccKVBIS6k1KYozDr7B1IHxXG",
  nature:
    "https://lh3.googleusercontent.com/aida/AEtjO1XXAyIs-P9GvogSAh4MeYc7kuNah8vr8uaczrDqdMwMxopMh-kMDjcHOY_i5eKLxkrCPjQ2VkfZYp4RKHXUPLN4s4fHKIHrq6CpI9TBzR3YLLiYYEEg2mF8VTmnjyiHmHV6lOeWrjqFIqT4RLKrtUVdFOoXpCrXx8sCmJopHaaF97YdVPweOssvESqNunVa6uqRRhFLi5UTmpwn59jUTHEdpgbl9UWYYY3TtKUFEUKgRFL10Ixkh5BYzYyU",
  sport:
    "https://lh3.googleusercontent.com/aida/AEtjO1XqEW9-EBmlGy_e2KQYPfbM_aQpN1-8Cs1aIYOX6Za1Ccai-5Etbkhm8DnFqXQQi0N6EZGrOEF1YMqg0yYBibqa6XBqj3wMRqlLoWkaL3ZfM9pb5Wl9Ra7bw82lSCyE8DAye36hgannm4QgDUrrHeZ-z99Q-bwHguV4qCML4FYd_Hxk-Td6hyX4MhBqxnLfbB3Vgu4gXg3ZoMBHc1ukvYIROiug4oyySLT0IGoeE2RQvVp3A-J8w3fz9BWb",
  children:
    "https://lh3.googleusercontent.com/aida/AEtjO1XbcluDITl9pEwGFBuUk0xKjnldx4zOGL3dPbrpcfMBLdSxqqPzKtCxjFgC0k5gAweMbPn7cntTcFiHre8g9ELbE0KTcNlzKbY3AHHUvmtZa6FeS-WqYj1Hhz8Iea9YohxNlNsTsMf6eRYrmdreCAtgSK1CsKIpoW3qctDjXY4o8XtzAd7h4M91UEjQqWTXWuddxBo9OLGrWLlva5uoRPJcEdTQ-P1DH_eOFcnPsBXdMW0jWqAOEb5dc6cx",
  music:
    "https://lh3.googleusercontent.com/aida/AEtjO1XGRA15bxfdZGx-tkY3uvMAUbCBxACvNcM-tlt2iSONF3fSLTJpip4R31iftHFJrAT5cg2Ap00L-MGLjXt9FHeAEWlAJ7mAIPR7ickpsgkyOTQRsL21xFT-fbRN4waZKlNzbikFkmBlWDGxUuO3EKfmUrvEioUU45eYBVFqErMXtJvDyNUzpfOD_Eh6Agnzc9sYOu4FfUfK-DEO2m7kQsmOn7UjbzWe_9CdR7jKqRz86pekAc6-jVBhWRvy",
} as const;

// All 16 starter layouts are order-of-service booklet content (cover /
// running order / back page — see makeStarterDoc in src/lib/designEditor.ts).
// Give the other products their own starter content before assigning any
// template to them.
const STARTER_PRODUCT = DEFAULT_PRODUCT;

export const TEMPLATES = [
  {
    id: "gentle-farewell",
    name: "Gentle Farewell",
    categories: ["classic", "religious", "simple"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.classic,
  },
  {
    id: "jamaican-peace",
    name: "Jamaican Peace",
    categories: ["colourful", "floral", "nature"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.themes,
  },
  {
    id: "lilac-bloom",
    name: "Lilac Bloom",
    categories: ["floral", "calm", "colourful"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "woodland-wreath",
    name: "Woodland Wreath",
    categories: ["floral", "nature", "calm"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "meadow-serenity",
    name: "Meadow Serenity",
    categories: ["floral", "colourful", "nature"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.themes,
  },
  {
    id: "silver-eucalyptus",
    name: "Silver Eucalyptus",
    categories: ["nature", "minimalistic", "classic"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.nature,
  },
  {
    id: "final-whistle",
    name: "Final Whistle",
    categories: ["sport", "modern", "colourful"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.sport,
  },
  {
    id: "service-and-honour",
    name: "Service and Honour",
    categories: ["military", "classic"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.classic,
  },
  {
    id: "autumn-blooms",
    name: "Autumn Blooms",
    categories: ["floral", "colourful", "nature"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "rose-elegance",
    name: "Rose Elegance",
    categories: ["floral", "classic", "colourful"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "crimson-petals",
    name: "Crimson Petals",
    categories: ["floral", "colourful", "modern"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "celestial-grace",
    name: "Celestial Grace",
    categories: ["calm", "colourful", "modern"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.themes,
  },
  {
    id: "still-waters",
    name: "Still Waters",
    categories: ["calm", "nature", "modern"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.nature,
  },
  {
    id: "sacred-light",
    name: "Sacred Light",
    categories: ["religious", "simple"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.religious,
  },
  {
    id: "wildflower-tribute",
    name: "Wildflower Tribute",
    categories: ["floral", "nature", "colourful"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "quiet-modern",
    name: "Quiet Modern",
    categories: ["modern", "minimalistic", "simple"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.themes,
  },
];

export interface ProductPricingSeed {
  /** Quantity breaks — larger runs reduce the per-copy rate. */
  quantity: (SeedOption & { value: number })[];
  /** Base per-copy `rate` in pounds, on the first paper option. */
  pages: { id: string; label: string; pages: number; rate: number; note?: string }[];
  paper: SeedOption[];
  /** `price` in pounds. */
  delivery: { id: string; label: string; price: number; note: string }[];
}

const DELIVERY: ProductPricingSeed["delivery"] = [
  {
    id: "standard",
    label: "Standard delivery",
    price: 0,
    note: "Free — 3 to 5 working days",
  },
  {
    id: "next-day",
    label: "Next day delivery",
    price: 10,
    note: "Order before 11am for next working day",
  },
];

/** Card and bookmark runs are smaller than booklet runs, and start lower. */
const CARD_QUANTITIES: ProductPricingSeed["quantity"] = [
  { id: "10", label: "10", value: 10, multiplier: 1 },
  { id: "25", label: "25", value: 25, multiplier: 0.9 },
  { id: "50", label: "50", value: 50, multiplier: 0.8 },
  { id: "75", label: "75", value: 75, multiplier: 0.75 },
  { id: "100", label: "100", value: 100, multiplier: 0.7 },
  { id: "150", label: "150", value: 150, multiplier: 0.65 },
  { id: "200", label: "200", value: 200, multiplier: 0.6 },
];

const CARD_PAPER: SeedOption[] = [
  {
    id: "silk-card",
    label: "Silk card",
    multiplier: 1,
    note: "350gsm silk card — sturdy, with a soft sheen",
  },
  {
    id: "gloss-card",
    label: "Gloss card",
    multiplier: 1,
    note: "350gsm gloss card — bright, high-contrast photographs",
  },
  {
    id: "uncoated-card",
    label: "Uncoated card",
    multiplier: 1.05,
    note: "350gsm uncoated card — natural, and easy to write on",
  },
];

const BOTH_SIDES = (rate: number) => [
  {
    id: "both-sides",
    label: "Printed both sides",
    pages: 2,
    rate,
    note: "Full colour on the front and the back",
  },
];

/** Every product's pricing tables, keyed by product slug. */
export const PRICING: Record<string, ProductPricingSeed> = {
  "order-of-service": {
    quantity: [
      { id: "15", label: "15", value: 15, multiplier: 1 },
      { id: "25", label: "25", value: 25, multiplier: 0.95 },
      { id: "50", label: "50", value: 50, multiplier: 0.9 },
      { id: "75", label: "75", value: 75, multiplier: 0.87 },
      { id: "100", label: "100", value: 100, multiplier: 0.84 },
      { id: "150", label: "150", value: 150, multiplier: 0.81 },
      { id: "200", label: "200", value: 200, multiplier: 0.78 },
      { id: "250", label: "250", value: 250, multiplier: 0.76 },
      { id: "300", label: "300", value: 300, multiplier: 0.74 },
    ],
    // Base per-copy rate (A5, silk).
    pages: [
      { id: "4", label: "4 page", pages: 4, rate: 2.2, note: "A single folded sheet" },
      { id: "8", label: "8 page", pages: 8, rate: 3.0 },
      { id: "12", label: "12 page", pages: 12, rate: 3.8 },
      { id: "16", label: "16 page", pages: 16, rate: 4.6 },
      { id: "20", label: "20 page", pages: 20, rate: 5.4 },
      { id: "24", label: "24 page", pages: 24, rate: 6.2, note: "Stapled on the spine" },
    ],
    paper: [
      {
        id: "silk",
        label: "Silk",
        multiplier: 1,
        note: "150gsm silk — a soft sheen that keeps photographs true",
      },
      {
        id: "gloss",
        label: "Gloss",
        multiplier: 1,
        note: "150gsm gloss — bright, high-contrast images",
      },
      {
        id: "uncoated",
        label: "Uncoated",
        multiplier: 1.05,
        note: "150gsm uncoated — natural, tactile finish, easy to write on",
      },
      {
        id: "premium-silk",
        label: "Premium Silk",
        multiplier: 1.2,
        note: "200gsm silk — our heaviest, most substantial stock",
      },
    ],
    delivery: DELIVERY,
  },
  "memorial-cards": {
    quantity: CARD_QUANTITIES,
    pages: BOTH_SIDES(1.1),
    paper: CARD_PAPER,
    delivery: DELIVERY,
  },
  bookmarks: {
    quantity: CARD_QUANTITIES,
    pages: BOTH_SIDES(1.2),
    paper: [
      ...CARD_PAPER,
      {
        id: "laminated",
        label: "Laminated silk card",
        multiplier: 1.25,
        note: "350gsm silk card, laminated both sides — wipe-clean and hard-wearing",
      },
    ],
    delivery: DELIVERY,
  },
  "thank-you-cards": {
    quantity: CARD_QUANTITIES,
    pages: BOTH_SIDES(0.95),
    paper: CARD_PAPER,
    delivery: DELIVERY,
  },
  // The page-count options are the board's print sizes (sizedByOption) —
  // each one page, of the same A-series design.
  "memory-board": {
    quantity: [
      { id: "1", label: "1", value: 1, multiplier: 1 },
      { id: "2", label: "2", value: 2, multiplier: 1 },
      { id: "3", label: "3", value: 3, multiplier: 1 },
    ],
    pages: [
      { id: "a4", label: "A4", pages: 1, rate: 12, note: "210 × 297 mm — for a table or a frame" },
      { id: "a3", label: "A3", pages: 1, rate: 18, note: "297 × 420 mm" },
      { id: "a2", label: "A2", pages: 1, rate: 28, note: "420 × 594 mm" },
      { id: "a1", label: "A1", pages: 1, rate: 40, note: "594 × 841 mm — the usual size for an easel" },
      { id: "a0", label: "A0", pages: 1, rate: 60, note: "841 × 1189 mm" },
    ],
    paper: [
      {
        id: "print-only",
        label: "Print only",
        multiplier: 1,
        note: "Printed on 200gsm satin poster paper, to frame or pin up",
      },
      {
        id: "mounted",
        label: "Mounted on 5mm board",
        multiplier: 1.6,
        note: "Mounted on rigid 5mm foam board, ready to stand on an easel or a table",
      },
      {
        id: "mounted-easel",
        label: "Mounted on 5mm board, with easel",
        multiplier: 2,
        note: "Mounted on 5mm foam board and sent with a display easel",
      },
    ],
    delivery: DELIVERY,
  },
};
