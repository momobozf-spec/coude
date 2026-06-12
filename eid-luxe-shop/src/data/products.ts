import type { Product } from "@/types";

// Base prices are in EUR. Converted at runtime via lib/currency.
export const products: Product[] = [
  {
    id: "p01",
    name: "Eid Mubarak Luxury Gift Box",
    slug: "eid-mubarak-luxury-gift-box",
    category: "eid-gift-boxes",
    price: 89,
    oldPrice: 109,
    currency: "EUR",
    description:
      "A signature gift box filled with hand-selected Eid essentials, beautifully wrapped and ready to give.",
    longDescription:
      "Our flagship Eid box brings together our finest dates, oud-scented candle, calligraphy print and authentic Moroccan tea. Presented in a gold-foiled keepsake box with hand-tied silk ribbon, this is the gift that turns Eid into a moment to remember.",
    whatsInside: [
      "Premium Ajwa Dates (250g)",
      "1001 Nights Oud Candle",
      "Gold-foil calligraphy print",
      "Moroccan green tea pouch",
      "Hand-written Eid Mubarak card",
    ],
    image: "luxury-box",
    imageAccent: "#d4af37",
    rating: 4.9,
    reviewCount: 312,
    badge: "best_seller",
    targetAudience: "family",
    collection: "1001-nights",
    stockStatus: "in_stock",
    featured: true,
    shippingNote: "Worldwide shipping in 3-5 business days.",
    returnNote: "Free returns within 14 days.",
  },
  {
    id: "p02",
    name: "Premium Ajwa Dates Box",
    slug: "premium-ajwa-dates-box",
    category: "dates-sweets",
    price: 39,
    currency: "EUR",
    description:
      "Hand-picked Ajwa dates from Madinah, presented in a luxurious wooden gift box.",
    longDescription:
      "Sourced directly from trusted growers in Madinah, our Ajwa dates are known for their soft texture, deep caramel flavour and rich nutritional profile. Each date is hand-inspected and packaged in a reusable wooden gift box.",
    whatsInside: [
      "500g of Ajwa dates from Madinah",
      "Reusable wooden keepsake box",
      "Origin certificate card",
    ],
    image: "dates-box",
    imageAccent: "#6e553a",
    rating: 4.8,
    reviewCount: 184,
    badge: "best_seller",
    targetAudience: "all",
    collection: "eid-essentials",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p03",
    name: "Moroccan Tea Ceremony Set",
    slug: "moroccan-tea-ceremony-set",
    category: "moroccan-lifestyle",
    price: 79,
    currency: "EUR",
    description:
      "A handcrafted Moroccan tea set with engraved silver-finished pot and six glasses.",
    longDescription:
      "Bring the warm Moroccan ritual of tea into your home. This set features a hand-engraved teapot with a silver finish, six matching tea glasses with gold rim, and a velvet-lined gift box.",
    whatsInside: [
      "Engraved teapot (1L)",
      "6 traditional tea glasses",
      "Velvet-lined keepsake box",
      "Loose-leaf Moroccan green tea (50g)",
    ],
    image: "tea-set",
    imageAccent: "#2d5a3d",
    rating: 4.7,
    reviewCount: 96,
    badge: "gift_ready",
    targetAudience: "family",
    collection: "moroccan",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p04",
    name: "Musk Al Tahara Perfume",
    slug: "musk-al-tahara-perfume",
    category: "musk-perfume",
    price: 29,
    currency: "EUR",
    description:
      "An iconic, alcohol-free white musk attar — light, clean and timeless.",
    longDescription:
      "A modern take on the classic Musk Al Tahara. Subtle white musk with hints of jasmine and powdery florals. Long-lasting, alcohol-free and presented in a hand-blown glass bottle.",
    whatsInside: [
      "Musk Al Tahara attar (12ml)",
      "Hand-blown glass bottle",
      "Silk pouch",
    ],
    image: "musk-perfume",
    imageAccent: "#f0d27a",
    rating: 4.9,
    reviewCount: 421,
    badge: "best_seller",
    targetAudience: "all",
    collection: "fragrance",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p05",
    name: "1001 Nights Candle Set",
    slug: "1001-nights-candle-set",
    category: "islamic-home-decor",
    price: 65,
    oldPrice: 79,
    currency: "EUR",
    description:
      "A trio of hand-poured candles inspired by oud, amber and rose.",
    longDescription:
      "Inspired by the legendary tales of 1001 Nights. Three hand-poured candles infused with natural oud, amber and rose absolute. Burns clean for 35+ hours each.",
    whatsInside: [
      "Oud Royal candle (180g)",
      "Amber Nights candle (180g)",
      "Rose of Damascus candle (180g)",
      "Gold-edged keepsake tray",
    ],
    image: "candle-set",
    imageAccent: "#b8941f",
    rating: 4.8,
    reviewCount: 152,
    badge: "limited_eid",
    targetAudience: "her",
    collection: "1001-nights",
    stockStatus: "low_stock",
    featured: true,
  },
  {
    id: "p06",
    name: "Prayer Mat Gift Set",
    slug: "prayer-mat-gift-set",
    category: "prayer-essentials",
    price: 55,
    currency: "EUR",
    description:
      "Soft velvet prayer mat with matching tasbih, in an elegant gift envelope.",
    longDescription:
      "A thick, plush velvet prayer mat with embroidered mihrab arch, paired with a 99-bead handcrafted tasbih. Comes with a luxurious gift envelope and Eid card.",
    whatsInside: [
      "Velvet prayer mat (110×70cm)",
      "Handcrafted 99-bead tasbih",
      "Gift envelope & card",
    ],
    image: "prayer-mat",
    imageAccent: "#234a30",
    rating: 4.7,
    reviewCount: 88,
    badge: "gift_ready",
    targetAudience: "him",
    collection: "prayer",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p07",
    name: "Islamic Wall Art Gold Edition",
    slug: "islamic-wall-art-gold-edition",
    category: "islamic-home-decor",
    price: 119,
    currency: "EUR",
    description:
      "Premium gold-foil Ayat al-Kursi calligraphy on archival paper, framed.",
    longDescription:
      "Handcrafted Ayat al-Kursi calligraphy printed with real gold foil on archival 300gsm paper, framed in solid oak. A timeless piece for any living room.",
    whatsInside: [
      "Gold-foil calligraphy print (50×70cm)",
      "Solid oak frame",
      "Wall mounting kit",
    ],
    image: "wall-art",
    imageAccent: "#d4af37",
    rating: 4.9,
    reviewCount: 67,
    badge: "premium",
    targetAudience: "family",
    collection: "decor",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p08",
    name: "Eid Kids Surprise Box",
    slug: "eid-kids-surprise-box",
    category: "gifts-for-kids",
    price: 49,
    currency: "EUR",
    description:
      "A magical Eid surprise box filled with treats, a soft toy and an activity book.",
    longDescription:
      "Make Eid unforgettable for the little ones. This colourful surprise box contains an Islamic activity book, a soft plush toy, halal-certified sweets and a personalised card.",
    whatsInside: [
      "Islamic activity & sticker book",
      "Plush toy (camel or lamb)",
      "Halal sweets selection",
      "Personalised Eid card",
    ],
    image: "kids-box",
    imageAccent: "#f0d27a",
    rating: 4.9,
    reviewCount: 213,
    badge: "best_seller",
    targetAudience: "kids",
    collection: "kids",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p09",
    name: "Oud Home Fragrance Set",
    slug: "oud-home-fragrance-set",
    category: "musk-perfume",
    price: 89,
    currency: "EUR",
    description:
      "Reed diffuser, room spray and bakhoor — a complete oud experience.",
    longDescription:
      "Fill your home with the warm depth of oud. Includes a 200ml reed diffuser, 100ml room spray and traditional bakhoor incense — all infused with authentic Cambodian oud.",
    whatsInside: [
      "Oud reed diffuser (200ml)",
      "Oud room spray (100ml)",
      "Premium bakhoor (40g)",
    ],
    image: "oud-set",
    imageAccent: "#553f29",
    rating: 4.8,
    reviewCount: 104,
    badge: "premium",
    targetAudience: "all",
    collection: "fragrance",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p10",
    name: "Luxury Self-care Gift Box",
    slug: "luxury-self-care-gift-box",
    category: "self-care",
    price: 75,
    currency: "EUR",
    description:
      "A spa-inspired Eid ritual: argan oil, black soap, kessa glove and rose water.",
    longDescription:
      "Inspired by the timeless beauty rituals of Morocco. Argan oil cold-pressed in the Atlas, black soap from Marrakech, kessa exfoliating glove and authentic rose water from the Valley of Roses.",
    whatsInside: [
      "Argan oil (100ml)",
      "Black soap (200g)",
      "Kessa glove",
      "Rose water (100ml)",
    ],
    image: "selfcare-box",
    imageAccent: "#3d6b4a",
    rating: 4.8,
    reviewCount: 178,
    badge: "gift_ready",
    targetAudience: "her",
    collection: "self-care",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p11",
    name: "Tasbih & Musk Gift Set",
    slug: "tasbih-musk-gift-set",
    category: "gifts-for-him",
    price: 45,
    currency: "EUR",
    description:
      "Handcrafted wooden tasbih paired with a signature musk attar.",
    longDescription:
      "A thoughtful gift for him: a 99-bead tasbih hand-carved from rosewood and a 12ml signature musk attar. Both come in a wooden gift box with a personalised Eid card.",
    whatsInside: [
      "Rosewood 99-bead tasbih",
      "Signature musk attar (12ml)",
      "Wooden gift box",
      "Personalised Eid card",
    ],
    image: "tasbih-set",
    imageAccent: "#6e553a",
    rating: 4.8,
    reviewCount: 76,
    badge: "gift_ready",
    targetAudience: "him",
    collection: "for-him",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p12",
    name: "Moroccan Lantern Decor",
    slug: "moroccan-lantern-decor",
    category: "moroccan-lifestyle",
    price: 59,
    currency: "EUR",
    description:
      "Hand-pierced metal lantern that casts intricate light patterns.",
    longDescription:
      "Crafted by artisans in Marrakech. The intricate hand-pierced metalwork casts a mesmerising star pattern across your walls. Designed for tea light or LED candle (not included).",
    whatsInside: [
      "Hand-pierced lantern (30cm)",
      "Cotton storage bag",
    ],
    image: "lantern",
    imageAccent: "#9a7a14",
    rating: 4.6,
    reviewCount: 49,
    badge: "new",
    targetAudience: "family",
    collection: "moroccan",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p13",
    name: "Family Eid Celebration Box",
    slug: "family-eid-celebration-box",
    category: "family-gifts",
    price: 149,
    oldPrice: 179,
    currency: "EUR",
    description:
      "Our most generous box — designed to celebrate Eid as a whole family.",
    longDescription:
      "The ultimate family Eid box: dates, sweets, fragrance, decor and a children's surprise — all in one large keepsake trunk. Perfect for sending love across borders.",
    whatsInside: [
      "Premium dates assortment (500g)",
      "Family-size baklava box",
      "Oud reed diffuser",
      "Kids' Eid surprise pouch",
      "Hand-tied Eid card",
    ],
    image: "family-box",
    imageAccent: "#2d5a3d",
    rating: 4.9,
    reviewCount: 87,
    badge: "limited_eid",
    targetAudience: "family",
    collection: "1001-nights",
    stockStatus: "low_stock",
    featured: true,
  },
  {
    id: "p14",
    name: "Minimal Islamic Calligraphy Frame",
    slug: "minimal-islamic-calligraphy-frame",
    category: "islamic-home-decor",
    price: 39,
    currency: "EUR",
    description:
      "Minimalist Bismillah print in matte black frame — modern and timeless.",
    longDescription:
      "A clean, modern take on Islamic calligraphy. Black ink on warm cream paper, set in a matte black frame. Pairs beautifully with neutral interiors.",
    whatsInside: [
      "Bismillah calligraphy print (30×40cm)",
      "Matte black frame",
    ],
    image: "minimal-frame",
    imageAccent: "#11291a",
    rating: 4.7,
    reviewCount: 53,
    badge: "new",
    targetAudience: "all",
    collection: "decor",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p15",
    name: "Rose & Oud Skincare Set",
    slug: "rose-oud-skincare-set",
    category: "self-care",
    price: 69,
    currency: "EUR",
    description:
      "Day cream, night serum and rose mist with authentic Damascus rose.",
    longDescription:
      "A luxurious skincare ritual blending the brightening powers of Damascus rose with the conditioning warmth of oud. Suitable for all skin types.",
    whatsInside: [
      "Rose & oud day cream (50ml)",
      "Night repair serum (30ml)",
      "Damascus rose mist (100ml)",
    ],
    image: "skincare-set",
    imageAccent: "#d4af37",
    rating: 4.7,
    reviewCount: 91,
    badge: "gift_ready",
    targetAudience: "her",
    collection: "self-care",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p16",
    name: "Gift Box for Him",
    slug: "gift-box-for-him",
    category: "gifts-for-him",
    price: 79,
    currency: "EUR",
    description:
      "A refined Eid gift for him — fragrance, dates and a leather tasbih.",
    longDescription:
      "A masculine yet elegant Eid gift. Includes our signature oud-musk attar, a hand-stitched leather tasbih, premium dates and a hand-written card. Wrapped in a black-and-gold gift box.",
    whatsInside: [
      "Signature oud-musk attar (12ml)",
      "Leather 99-bead tasbih",
      "Premium Medjool dates (250g)",
      "Hand-written card",
    ],
    image: "him-box",
    imageAccent: "#1a3a25",
    rating: 4.8,
    reviewCount: 132,
    badge: "best_seller",
    targetAudience: "him",
    collection: "for-him",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p17",
    name: "Gift Box for Her",
    slug: "gift-box-for-her",
    category: "gifts-for-her",
    price: 79,
    currency: "EUR",
    description:
      "A delicate Eid gift for her — rose, gold and a touch of oud.",
    longDescription:
      "A graceful gift box created with her in mind. Rose-infused skincare, a gold-foil candle, signature rose attar and a delicate Eid card. Packaged in a blush keepsake box.",
    whatsInside: [
      "Rose & oud face cream (50ml)",
      "Gold-foil rose candle (180g)",
      "Signature rose attar (10ml)",
      "Eid card",
    ],
    image: "her-box",
    imageAccent: "#d4af37",
    rating: 4.9,
    reviewCount: 168,
    badge: "best_seller",
    targetAudience: "her",
    collection: "for-her",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p18",
    name: "Premium Kaftan Gift Set",
    slug: "premium-kaftan-gift-set",
    category: "gifts-for-her",
    price: 159,
    currency: "EUR",
    description:
      "An embroidered kaftan paired with a matching satin headscarf.",
    longDescription:
      "Crafted from flowing satin with hand-embroidered gold detailing along the neckline. Comes with a matching satin headscarf and a velvet keepsake bag.",
    whatsInside: [
      "Embroidered satin kaftan (one size)",
      "Matching satin headscarf",
      "Velvet keepsake bag",
    ],
    image: "kaftan",
    imageAccent: "#9a7a14",
    rating: 4.8,
    reviewCount: 41,
    badge: "limited_eid",
    targetAudience: "her",
    collection: "for-her",
    stockStatus: "low_stock",
    featured: false,
  },
  {
    id: "p19",
    name: "Mini Quran Stand Decor",
    slug: "mini-quran-stand-decor",
    category: "prayer-essentials",
    price: 35,
    currency: "EUR",
    description:
      "Hand-carved walnut Qur'an stand with subtle gold inlay.",
    longDescription:
      "A beautifully crafted Qur'an stand made from solid walnut, with subtle gold inlay along the edges. Folds flat for easy storage. A meaningful gift for any Muslim home.",
    whatsInside: [
      "Walnut Qur'an stand (30×30cm)",
      "Soft cotton dust bag",
    ],
    image: "quran-stand",
    imageAccent: "#553f29",
    rating: 4.7,
    reviewCount: 38,
    badge: "new",
    targetAudience: "all",
    collection: "prayer",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p20",
    name: "Sabr & Shukr Home Set",
    slug: "sabr-shukr-home-set",
    category: "islamic-home-decor",
    price: 49,
    currency: "EUR",
    description:
      "A duo of minimalist 'Sabr' and 'Shukr' prints — gentle daily reminders.",
    longDescription:
      "Two minimalist prints to bring intention into your home. 'Sabr' (patience) and 'Shukr' (gratitude) in modern Arabic calligraphy on warm cream paper, set in slim oak frames.",
    whatsInside: [
      "Sabr print (30×40cm)",
      "Shukr print (30×40cm)",
      "2 oak frames",
    ],
    image: "sabr-shukr",
    imageAccent: "#3d6b4a",
    rating: 4.8,
    reviewCount: 64,
    badge: "new",
    targetAudience: "all",
    collection: "decor",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p21",
    name: "Date & Chocolate Eid Box",
    slug: "date-chocolate-eid-box",
    category: "dates-sweets",
    price: 45,
    currency: "EUR",
    description:
      "Belgian chocolate-coated dates filled with pistachio and orange.",
    longDescription:
      "Plump Medjool dates filled with crushed pistachio or candied orange peel, then dipped in 70% Belgian dark chocolate. A luxurious bite that pairs beautifully with mint tea.",
    whatsInside: [
      "Pistachio chocolate dates (16 pieces)",
      "Orange chocolate dates (16 pieces)",
      "Gold-foil presentation tray",
    ],
    image: "choc-dates",
    imageAccent: "#6e553a",
    rating: 4.9,
    reviewCount: 224,
    badge: "best_seller",
    targetAudience: "all",
    collection: "eid-essentials",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p22",
    name: "Luxury Bakhoor Burner Set",
    slug: "luxury-bakhoor-burner-set",
    category: "musk-perfume",
    price: 95,
    currency: "EUR",
    description:
      "Electric bakhoor burner with three signature bakhoor blends.",
    longDescription:
      "A modern, electric bakhoor burner — no charcoal or smoke. Heat-controlled to release the full aroma of our three exclusive blends: Royal Oud, Amber Nights and Rose Cambodi.",
    whatsInside: [
      "Electric bakhoor burner",
      "Royal Oud bakhoor (40g)",
      "Amber Nights bakhoor (40g)",
      "Rose Cambodi bakhoor (40g)",
    ],
    image: "bakhoor",
    imageAccent: "#553f29",
    rating: 4.7,
    reviewCount: 58,
    badge: "premium",
    targetAudience: "all",
    collection: "fragrance",
    stockStatus: "in_stock",
    featured: false,
  },
  {
    id: "p23",
    name: "Ramadan to Eid Home Bundle",
    slug: "ramadan-to-eid-home-bundle",
    category: "family-gifts",
    price: 129,
    currency: "EUR",
    description:
      "A bundle to carry the spirit of Ramadan into a beautiful Eid.",
    longDescription:
      "Designed to be enjoyed across the whole month and into the celebration. Includes daily-use prayer beads, a ceramic dates dish, two candles and a curated tea-and-treats selection.",
    whatsInside: [
      "Ceramic dates dish",
      "Daily prayer beads",
      "2 hand-poured candles",
      "Moroccan green tea + treats",
    ],
    image: "ramadan-bundle",
    imageAccent: "#234a30",
    rating: 4.8,
    reviewCount: 79,
    badge: "limited_eid",
    targetAudience: "family",
    collection: "1001-nights",
    stockStatus: "in_stock",
    featured: true,
  },
  {
    id: "p24",
    name: "Jannah Inspired Gift Set",
    slug: "jannah-inspired-gift-set",
    category: "1001-nights",
    price: 109,
    currency: "EUR",
    description:
      "A serene set inspired by gardens of paradise — rose, jasmine and oud.",
    longDescription:
      "A meditative set: a Jannah-scented soy candle, dried rose buds, a jasmine reed diffuser and a 'Bismillah' calligraphy card. Beautifully packaged for gifting.",
    whatsInside: [
      "Jannah soy candle (200g)",
      "Dried rose bud jar",
      "Jasmine reed diffuser (150ml)",
      "Bismillah calligraphy card",
    ],
    image: "jannah-set",
    imageAccent: "#3d6b4a",
    rating: 4.9,
    reviewCount: 102,
    badge: "premium",
    targetAudience: "all",
    collection: "1001-nights",
    stockStatus: "in_stock",
    featured: true,
  },
];

export const findProduct = (slug: string) =>
  products.find((p) => p.slug === slug || p.id === slug);

export const productsByCategory = (categoryId: string) =>
  products.filter((p) => p.category === categoryId);

export const featuredProducts = () => products.filter((p) => p.featured);

export const bestSellers = () =>
  products.filter((p) => p.badge === "best_seller");

export const newArrivals = () => products.filter((p) => p.badge === "new");

export const limitedEid = () =>
  products.filter((p) => p.badge === "limited_eid");

export const giftBoxes = () =>
  products.filter(
    (p) =>
      p.category === "eid-gift-boxes" ||
      p.category === "family-gifts" ||
      p.slug.includes("gift-box") ||
      p.slug.includes("gift-set"),
  );

export const relatedProducts = (productId: string, limit = 4) => {
  const current = products.find((p) => p.id === productId);
  if (!current) return [];
  return products
    .filter(
      (p) =>
        p.id !== productId &&
        (p.category === current.category ||
          p.collection === current.collection ||
          p.targetAudience === current.targetAudience),
    )
    .slice(0, limit);
};
