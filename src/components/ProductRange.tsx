import Image from "next/image";

const CATEGORIES = [
  {
    name: "Floral",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1XqBO5jCj3jWJCsF_gzJxW5VTOB3Ha-R84QTsA7Niioyk4p5qo45fBJZ9oXdHCCfkBqLbw2GZ52O_SO-fKCo2MLVi2bpJN5FEYT4Db30bES1DOD9dN9Qukcm6GhlfT75ZNd4BMkrL4ryrbJehSMqfaJmMNzP1HzEc2B46m93IagiYQGf4nwQy8kT5P6WDeIsJU3yYGuB5M_vkmuL3mBsc4poWN9MW_JeAz6QRU6VImktNK5OdTNSWpc9C5F",
  },
  {
    name: "Themes",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1VOOoXItMXQIpHmmzRXFehnOsKeeEb0NqG83BsJGvSIb31faAFaBKgFv6k1Rv5148dOSPJrjEqHWIX25RdafO_WNC-hScUKEONqdOVC4J5s_eGouqUEIPVftcg48qubsdzkoRLDJlUM-Qr0Rz3uMvv6std5jCApjrheqlQ4Dv1-x2OkVpts9YP6FiQbkTpeitNZcBTC-3LT2tsYlwqVC9BBj0czLbnF9zEeWr6re6Aa-Pq8k-6UXdZYggA",
  },
  {
    name: "Classic",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1UZ-qKw2zOQhr6QfvfFb6-r7WRdHlE5U6j6qJ4Jxt5AXS6AttERQGRnTr-bQ31v31ImAw5oTaLC7K1q50_udIDPuwWb447CYNK9zlP7V_wVKYQ5AGIvyLv-zU8qO0IMYTggeWp-DjGBVk_FCW-Bdr-c_7QPoDeXB_L4DRQ_JrtH6vGb4PZ2iVqU5XghErR0rG9B4IsvrIiLvwOtZc9VoEkpyMQ6BttDshSqfHGFKCVdbTPGBuyZVYDiJluA",
  },
  {
    name: "Religious",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1VwVfmZTjX4wVvrv01kzxYvhW_KOmKM2p7EUf3dt2vFmlvm51OsOzhhEABnQ6cVW85PyYCTGg_tazz608tlvuri8rja7f7Vakmi2bQPeUeHNXwJYdh3BM1FNRxrcNEHQD9tLIrWFRWN3-sSFEK2JyTm-_QVvkJ19KErZeBxX57Xl1_LmB56c-tcLF-_fWX1FFjU2TfX-vdts5yZILBYzXna5Sw18--WcTsVccKVBIS6k1KYozDr7B1IHxXG",
  },
  {
    name: "Nature",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1XXAyIs-P9GvogSAh4MeYc7kuNah8vr8uaczrDqdMwMxopMh-kMDjcHOY_i5eKLxkrCPjQ2VkfZYp4RKHXUPLN4s4fHKIHrq6CpI9TBzR3YLLiYYEEg2mF8VTmnjyiHmHV6lOeWrjqFIqT4RLKrtUVdFOoXpCrXx8sCmJopHaaF97YdVPweOssvESqNunVa6uqRRhFLi5UTmpwn59jUTHEdpgbl9UWYYY3TtKUFEUKgRFL10Ixkh5BYzYyU",
  },
  {
    name: "Sport",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1XqEW9-EBmlGy_e2KQYPfbM_aQpN1-8Cs1aIYOX6Za1Ccai-5Etbkhm8DnFqXQQi0N6EZGrOEF1YMqg0yYBibqa6XBqj3wMRqlLoWkaL3ZfM9pb5Wl9Ra7bw82lSCyE8DAye36hgannm4QgDUrrHeZ-z99Q-bwHguV4qCML4FYd_Hxk-Td6hyX4MhBqxnLfbB3Vgu4gXg3ZoMBHc1ukvYIROiug4oyySLT0IGoeE2RQvVp3A-J8w3fz9BWb",
  },
  {
    name: "Children",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1XbcluDITl9pEwGFBuUk0xKjnldx4zOGL3dPbrpcfMBLdSxqqPzKtCxjFgC0k5gAweMbPn7cntTcFiHre8g9ELbE0KTcNlzKbY3AHHUvmtZa6FeS-WqYj1Hhz8Iea9YohxNlNsTsMf6eRYrmdreCAtgSK1CsKIpoW3qctDjXY4o8XtzAd7h4M91UEjQqWTXWuddxBo9OLGrWLlva5uoRPJcEdTQ-P1DH_eOFcnPsBXdMW0jWqAOEb5dc6cx",
  },
  {
    name: "Music",
    image:
      "https://lh3.googleusercontent.com/aida/AEtjO1XGRA15bxfdZGx-tkY3uvMAUbCBxACvNcM-tlt2iSONF3fSLTJpip4R31iftHFJrAT5cg2Ap00L-MGLjXt9FHeAEWlAJ7mAIPR7ickpsgkyOTQRsL21xFT-fbRN4waZKlNzbikFkmBlWDGxUuO3EKfmUrvEioUU45eYBVFqErMXtJvDyNUzpfOD_Eh6Agnzc9sYOu4FfUfK-DEO2m7kQsmOn7UjbzWe_9CdR7jKqRz86pekAc6-jVBhWRvy",
  },
];

const EXTRA_PRODUCTS = [
  "Pet Sympathy Cards",
  "Memorial Cards",
  "Bookmarks",
  "Thank You Cards",
];

export default function ProductRange() {
  return (
    <section
      id="templates"
      className="py-section-gap px-margin-mobile md:px-gutter bg-surface"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-primary mb-4">
            Our Product Range
          </h2>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl mx-auto">
            Browse our collection of beautifully crafted designs to find the
            perfect tribute.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {CATEGORIES.map((category) => (
            <a key={category.name} href="#" className="group block text-center">
              <div className="bg-surface-container-low rounded-xl p-4 mb-4 h-64 flex items-center justify-center ambient-shadow transition-transform duration-300 group-hover:-translate-y-1 relative overflow-hidden">
                <Image
                  src={category.image}
                  alt={`${category.name} Designs`}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-contain p-2"
                />
              </div>
              <h3 className="font-display text-xl text-on-surface group-hover:text-primary transition-colors">
                {category.name}
              </h3>
            </a>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          {EXTRA_PRODUCTS.map((product) => (
            <span
              key={product}
              className="px-6 py-3 bg-surface-container-highest text-on-surface-variant rounded-full text-sm font-medium tracking-wide"
            >
              {product}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
