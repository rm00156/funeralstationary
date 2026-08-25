/**
 * Template catalogue for the /templates browser.
 *
 * PLACEHOLDER ARTWORK — every entry currently points at one of the Stitch
 * export images already used elsewhere on the site. Swap `image` for the real
 * template previews when they are available; nothing else needs to change.
 */

export interface Product {
  id: string;
  label: string;
}

export interface TemplateCategory {
  id: string;
  label: string;
}

export interface Template {
  id: string;
  name: string;
  /** Category ids this design belongs to. */
  categories: string[];
  /**
   * The single product this design's starter content is built for — its
   * layout (cover / running order / back page, via makeStarterDoc) is
   * specific to that product's format, so a template belongs to exactly one
   * product, not many.
   */
  productId: string;
  image: string;
}

export const PRODUCTS: Product[] = [
  { id: "order-of-service", label: "Order of Service Booklets" },
  { id: "memorial-cards", label: "Memorial Cards" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "thank-you-cards", label: "Thank You Cards" },
  { id: "attendance-cards", label: "Attendance Cards" },
  { id: "pet-sympathy", label: "Pet Sympathy Cards" },
];

export const DEFAULT_PRODUCT = PRODUCTS[0].id;

export const CATEGORIES: TemplateCategory[] = [
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

export const TEMPLATES: Template[] = [
  {
    id: "gentle-farewell",
    name: "Gentle Farewell",
    categories: ["classic", "minimalistic", "simple"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.classic,
  },
  {
    id: "evergreen-peace",
    name: "Evergreen Peace",
    categories: ["nature", "calm", "simple"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.nature,
  },
  {
    id: "eternal-lilies",
    name: "Eternal Lilies",
    categories: ["floral", "classic"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "quiet-devotion",
    name: "Quiet Devotion",
    categories: ["religious", "classic"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.religious,
  },
  {
    id: "meadow-serenity",
    name: "Meadow Serenity",
    categories: ["nature", "calm", "colourful"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.themes,
  },
  {
    id: "morning-birdsong",
    name: "Morning Birdsong",
    categories: ["birds", "nature", "calm"],
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
    id: "soft-linen",
    name: "Soft Linen",
    categories: ["minimalistic", "simple", "modern"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.themes,
  },
  {
    id: "rose-elegance",
    name: "Rose Elegance",
    categories: ["floral", "classic", "colourful"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.floral,
  },
  {
    id: "last-encore",
    name: "Last Encore",
    categories: ["modern", "colourful"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.music,
  },
  {
    id: "little-star",
    name: "Little Star",
    categories: ["calm", "colourful", "simple"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.children,
  },
  {
    id: "still-waters",
    name: "Still Waters",
    categories: ["calm", "nature", "minimalistic"],
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
    categories: ["modern", "minimalistic"],
    productId: STARTER_PRODUCT,
    image: ARTWORK.themes,
  },
];

export function filterTemplates(productId: string, categoryId: string | null) {
  return TEMPLATES.filter(
    (template) =>
      template.productId === productId &&
      (categoryId === null || template.categories.includes(categoryId)),
  );
}
