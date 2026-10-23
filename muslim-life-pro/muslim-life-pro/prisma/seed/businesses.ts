import type { PrismaClient } from '@prisma/client'

/**
 * DEMONSTRATION DATA.
 *
 * Every business below is fictional and is flagged `isDemo: true`, which renders a
 * "Demo listing" badge everywhere it appears. Names, addresses and contact details
 * are invented. We never present unverified listings as real businesses — that would
 * be dishonest to members and unfair to the actual businesses in these cities.
 *
 * Real partner listings are added city by city with `isDemo: false`.
 */

interface BusinessSeed {
  name: string
  slug: string
  description: string
  categorySlug: string
  citySlug: string
  countryCode: string
  address: string
  postalCode: string
  phone: string
  website: string
  priceLevel: number
  rating: number
  reviewCount: number
  tier: 'BASIC' | 'ENHANCED' | 'FEATURED'
  /** Which opening-hours pattern this listing uses. */
  hours: 'FOOD' | 'RETAIL' | 'LATE' | 'MOSQUE'
  deals: DealSeed[]
}

interface DealSeed {
  title: string
  description: string
  discountType: 'PERCENTAGE' | 'FIXED' | 'BOGO' | 'FREEBIE'
  discountValue: number
  code?: string
  terms: string
  isPremiumOnly: boolean
  priority: number
}

/**
 * Opening-hour patterns.
 *
 * Deliberately varied so the open-state logic is exercised by the seed itself:
 * a Friday split for Jumu'ah, a late-night kebab shop that closes after midnight,
 * a retailer shut on Sunday, and a mosque open from Fajr to Isha.
 */
const HOUR_PATTERNS = {
  // Restaurant: closes for Jumu'ah on Friday, later at weekends.
  FOOD: {
    mon: [['11:30', '22:00']],
    tue: [['11:30', '22:00']],
    wed: [['11:30', '22:00']],
    thu: [['11:30', '22:00']],
    fri: [['11:30', '12:30'], ['14:00', '23:00']],
    sat: [['11:30', '23:00']],
    sun: [['12:00', '21:00']],
  },
  // Retail: closed Sundays, shorter Saturday.
  RETAIL: {
    mon: [['10:00', '18:30']],
    tue: [['10:00', '18:30']],
    wed: [['10:00', '18:30']],
    thu: [['10:00', '18:30']],
    fri: [['10:00', '12:15'], ['14:15', '19:00']],
    sat: [['10:00', '18:00']],
    sun: [] as string[][],
  },
  // Late-night: genuinely crosses midnight, which the open-state logic must handle.
  LATE: {
    mon: [['17:00', '01:00']],
    tue: [['17:00', '01:00']],
    wed: [['17:00', '01:00']],
    thu: [['17:00', '02:00']],
    fri: [['17:00', '03:00']],
    sat: [['17:00', '03:00']],
    sun: [['17:00', '00:30']],
  },
  // Mosque: open across the prayer day.
  MOSQUE: {
    mon: [['05:00', '22:30']],
    tue: [['05:00', '22:30']],
    wed: [['05:00', '22:30']],
    thu: [['05:00', '22:30']],
    fri: [['05:00', '23:00']],
    sat: [['05:00', '22:30']],
    sun: [['05:00', '22:30']],
  },
} as const

export const BUSINESSES: BusinessSeed[] = [
  // ── Brussels ──────────────────────────────────────────────────────────────
  {
    name: 'Atlas Grill',
    slug: 'atlas-grill-brussels',
    description:
      'A family-run grill house serving Moroccan and Belgian classics. Charcoal-grilled meats, fresh bread baked through the day, and mint tea worth staying for.',
    categorySlug: 'restaurants',
    citySlug: 'brussels',
    countryCode: 'BE',
    address: 'Rue de Brabant 112',
    postalCode: '1030',
    phone: '+32 2 000 00 01',
    website: 'https://example.com/atlas-grill',
    priceLevel: 2,
    rating: 4.6,
    reviewCount: 218,
    hours: 'FOOD',
    tier: 'FEATURED',
    deals: [
      {
        title: '20% off your table',
        description:
          'Twenty percent off the total bill for Muslim Life Premium members, any day of the week.',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        code: 'MLATLAS20',
        terms:
          'Show the code in the app before paying. One use per member per visit. Cannot be combined with other offers.',
        isPremiumOnly: true,
        priority: 100,
      },
    ],
  },
  {
    name: 'Boucherie Al Baraka',
    slug: 'boucherie-al-baraka-brussels',
    description:
      'Neighbourhood halal butcher with lamb, beef and poultry cut to order, plus house-made merguez and marinades prepared each morning.',
    categorySlug: 'butchers',
    citySlug: 'brussels',
    countryCode: 'BE',
    address: 'Chaussée de Gand 245',
    postalCode: '1080',
    phone: '+32 2 000 00 02',
    website: 'https://example.com/al-baraka',
    priceLevel: 2,
    rating: 4.8,
    reviewCount: 143,
    hours: 'RETAIL',
    tier: 'ENHANCED',
    deals: [
      {
        title: 'Free delivery over €50',
        description: 'Free delivery across Brussels on orders over fifty euros.',
        discountType: 'FREEBIE',
        discountValue: 0,
        terms: 'Brussels-Capital Region only. Orders placed before 15:00 are delivered same day.',
        isPremiumOnly: false,
        priority: 50,
      },
    ],
  },
  {
    name: 'Dar Al Kitab',
    slug: 'dar-al-kitab-brussels',
    description:
      'Islamic bookshop stocking Qurans, tafsir, hadith collections and childrens books in Arabic, French, Dutch and English.',
    categorySlug: 'bookstores',
    citySlug: 'brussels',
    countryCode: 'BE',
    address: 'Rue Vanderstichelen 18',
    postalCode: '1080',
    phone: '+32 2 000 00 03',
    website: 'https://example.com/dar-al-kitab',
    priceLevel: 2,
    rating: 4.7,
    reviewCount: 89,
    hours: 'RETAIL',
    tier: 'BASIC',
    deals: [
      {
        title: '15% off all books',
        description: 'Fifteen percent off every title in store and online.',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        code: 'MLKITAB15',
        terms: 'Excludes already discounted items and special orders.',
        isPremiumOnly: false,
        priority: 40,
      },
    ],
  },
  {
    name: 'Café Zahra',
    slug: 'cafe-zahra-brussels',
    description:
      'Quiet speciality coffee bar with a small library, reliable wifi and a prayer space upstairs. A good place to work between Dhuhr and Asr.',
    categorySlug: 'cafes',
    citySlug: 'brussels',
    countryCode: 'BE',
    address: 'Place Saint-Josse 7',
    postalCode: '1210',
    phone: '+32 2 000 00 04',
    website: 'https://example.com/cafe-zahra',
    priceLevel: 2,
    rating: 4.5,
    reviewCount: 176,
    hours: 'FOOD',
    tier: 'BASIC',
    deals: [
      {
        title: 'Second coffee free',
        description: 'Buy one speciality coffee, get the second free before 11:00.',
        discountType: 'BOGO',
        discountValue: 0,
        terms: 'Weekdays before 11:00. Dine in only.',
        isPremiumOnly: true,
        priority: 60,
      },
    ],
  },

  // ── Amsterdam ─────────────────────────────────────────────────────────────
  {
    name: 'Noor Books',
    slug: 'noor-books-amsterdam',
    description:
      'Independent bookshop focused on Islamic scholarship, history and Muslim fiction, with a well-curated childrens section.',
    categorySlug: 'bookstores',
    citySlug: 'amsterdam',
    countryCode: 'NL',
    address: 'Javastraat 64',
    postalCode: '1094 HL',
    phone: '+31 20 000 0001',
    website: 'https://example.com/noor-books',
    priceLevel: 2,
    rating: 4.8,
    reviewCount: 124,
    hours: 'RETAIL',
    tier: 'ENHANCED',
    deals: [
      {
        title: '15% off your first order',
        description: 'Fifteen percent off for members shopping with us for the first time.',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        code: 'MLNOOR15',
        terms: 'One use per member. Valid in store and online.',
        isPremiumOnly: false,
        priority: 45,
      },
    ],
  },
  {
    name: 'Bosphorus Kitchen',
    slug: 'bosphorus-kitchen-amsterdam',
    description:
      'Turkish home cooking — pide from a stone oven, slow-cooked stews and a mezze counter that changes daily.',
    categorySlug: 'restaurants',
    citySlug: 'amsterdam',
    countryCode: 'NL',
    address: 'Kinkerstraat 210',
    postalCode: '1053 EL',
    phone: '+31 20 000 0002',
    website: 'https://example.com/bosphorus',
    priceLevel: 2,
    rating: 4.5,
    reviewCount: 302,
    hours: 'FOOD',
    tier: 'FEATURED',
    deals: [
      {
        title: '€10 off orders over €40',
        description: 'Ten euros off any bill above forty euros.',
        discountType: 'FIXED',
        discountValue: 1000,
        code: 'MLBOS10',
        terms: 'Dine in only. Not valid on public holidays.',
        isPremiumOnly: true,
        priority: 90,
      },
    ],
  },
  {
    name: 'Amana Modest',
    slug: 'amana-modest-amsterdam',
    description:
      'Modest womenswear designed and made in the Netherlands. Abayas, tailored separates and everyday knitwear in natural fabrics.',
    categorySlug: 'modest-fashion',
    citySlug: 'amsterdam',
    countryCode: 'NL',
    address: 'Ferdinand Bolstraat 45',
    postalCode: '1072 LD',
    phone: '+31 20 000 0003',
    website: 'https://example.com/amana-modest',
    priceLevel: 3,
    rating: 4.6,
    reviewCount: 97,
    hours: 'RETAIL',
    tier: 'BASIC',
    deals: [
      {
        title: '10% off the new season',
        description: 'Ten percent off all new season pieces.',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        code: 'MLAMANA10',
        terms: 'Excludes sale items.',
        isPremiumOnly: false,
        priority: 30,
      },
    ],
  },

  // ── London ────────────────────────────────────────────────────────────────
  {
    name: 'Yusuf Butchery',
    slug: 'yusuf-butchery-london',
    description:
      'Third-generation halal butcher supplying homes and restaurants across east London. Grass-fed beef, free-range poultry, whole lamb to order.',
    categorySlug: 'butchers',
    citySlug: 'london',
    countryCode: 'GB',
    address: '188 Whitechapel Road',
    postalCode: 'E1 1BJ',
    phone: '+44 20 0000 0001',
    website: 'https://example.com/yusuf-butchery',
    priceLevel: 2,
    rating: 4.7,
    reviewCount: 411,
    hours: 'RETAIL',
    tier: 'ENHANCED',
    deals: [
      {
        title: 'Free delivery in E1–E14',
        description: 'Free delivery across east London on orders over £40.',
        discountType: 'FREEBIE',
        discountValue: 0,
        terms: 'Orders over £40. Next-day delivery, Monday to Saturday.',
        isPremiumOnly: false,
        priority: 55,
      },
    ],
  },
  {
    name: 'The Date Room',
    slug: 'the-date-room-london',
    description:
      'Dates, honey, nuts and gift boxes sourced from Madinah, Tunisia and Iran. Ajwa and Medjool in season, plus Ramadan hampers.',
    categorySlug: 'grocery',
    citySlug: 'london',
    countryCode: 'GB',
    address: '24 Edgware Road',
    postalCode: 'W2 2EH',
    phone: '+44 20 0000 0002',
    website: 'https://example.com/the-date-room',
    priceLevel: 3,
    rating: 4.9,
    reviewCount: 268,
    hours: 'RETAIL',
    tier: 'FEATURED',
    deals: [
      {
        title: '25% off gift boxes',
        description: 'Twenty-five percent off all gift boxes and Ramadan hampers.',
        discountType: 'PERCENTAGE',
        discountValue: 25,
        code: 'MLDATES25',
        terms: 'Online and in store. While stocks last.',
        isPremiumOnly: true,
        priority: 95,
      },
    ],
  },
  {
    name: 'Hijra Travel',
    slug: 'hijra-travel-london',
    description:
      'Umrah and Hajj packages with group departures from Heathrow, plus family-friendly halal holiday planning.',
    categorySlug: 'travel',
    citySlug: 'london',
    countryCode: 'GB',
    address: '9 Green Street',
    postalCode: 'E7 8DA',
    phone: '+44 20 0000 0003',
    website: 'https://example.com/hijra-travel',
    priceLevel: 3,
    rating: 4.4,
    reviewCount: 156,
    hours: 'RETAIL',
    tier: 'BASIC',
    deals: [
      {
        title: '£75 off Umrah packages',
        description: 'Seventy-five pounds off any Umrah package booked through Muslim Life.',
        discountType: 'FIXED',
        discountValue: 7500,
        code: 'MLHIJRA75',
        terms: 'Per booking, not per traveller. Subject to availability.',
        isPremiumOnly: true,
        priority: 80,
      },
    ],
  },

  // ── Paris ─────────────────────────────────────────────────────────────────
  {
    name: 'Maison Modeste',
    slug: 'maison-modeste-paris',
    description:
      'Parisian modest fashion house working in linen, wool and silk. Considered tailoring, made in small runs.',
    categorySlug: 'modest-fashion',
    citySlug: 'paris',
    countryCode: 'FR',
    address: '32 Rue du Faubourg Saint-Denis',
    postalCode: '75010',
    phone: '+33 1 00 00 00 01',
    website: 'https://example.com/maison-modeste',
    priceLevel: 3,
    rating: 4.7,
    reviewCount: 134,
    hours: 'RETAIL',
    tier: 'FEATURED',
    deals: [
      {
        title: '10% off everything',
        description: 'Ten percent off the entire collection for members.',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        code: 'MLMAISON10',
        terms: 'Valid in the Paris store and online. Excludes sale.',
        isPremiumOnly: true,
        priority: 85,
      },
    ],
  },
  {
    name: 'Pâtisserie Andalus',
    slug: 'patisserie-andalus-paris',
    description:
      'North African and French pastry side by side. Cornes de gazelle, baklava, and a croissant that holds its own.',
    categorySlug: 'bakeries',
    citySlug: 'paris',
    countryCode: 'FR',
    address: '77 Boulevard de Belleville',
    postalCode: '75011',
    phone: '+33 1 00 00 00 02',
    website: 'https://example.com/patisserie-andalus',
    priceLevel: 2,
    rating: 4.6,
    reviewCount: 289,
    hours: 'FOOD',
    tier: 'BASIC',
    deals: [
      {
        title: 'Free mint tea with any box',
        description: 'A complimentary mint tea with every pastry box.',
        discountType: 'FREEBIE',
        discountValue: 0,
        terms: 'In store only. One per visit.',
        isPremiumOnly: false,
        priority: 35,
      },
    ],
  },
  {
    name: 'Attar de Paris',
    slug: 'attar-de-paris-paris',
    description:
      'Alcohol-free attars and oud blended in house, alongside oud, bakhoor and burners.',
    categorySlug: 'perfume',
    citySlug: 'paris',
    countryCode: 'FR',
    address: '14 Rue de la Goutte d\'Or',
    postalCode: '75018',
    phone: '+33 1 00 00 00 03',
    website: 'https://example.com/attar-de-paris',
    priceLevel: 3,
    rating: 4.8,
    reviewCount: 112,
    hours: 'RETAIL',
    tier: 'ENHANCED',
    deals: [
      {
        title: '20% off attars',
        description: 'Twenty percent off all house-blended attars.',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        code: 'MLATTAR20',
        terms: 'Excludes oud wood and limited editions.',
        isPremiumOnly: true,
        priority: 75,
      },
    ],
  },

  // ── Mosques & community (all four cities) ─────────────────────────────────
  {
    name: 'Masjid An-Nur (demo)',
    slug: 'masjid-an-nur-brussels',
    description:
      'A demonstration mosque listing showing how prayer spaces would appear in discovery. Congregational prayers, a weekend school and a small library.',
    categorySlug: 'mosques',
    citySlug: 'brussels',
    countryCode: 'BE',
    address: 'Rue du Progrès 44',
    postalCode: '1210',
    phone: '+32 2 000 00 05',
    website: 'https://example.com/masjid-an-nur',
    priceLevel: 1,
    rating: 4.9,
    reviewCount: 64,
    hours: 'MOSQUE',
    tier: 'BASIC',
    deals: [],
  },
  {
    name: 'Bait Al-Salam Centre (demo)',
    slug: 'bait-al-salam-london',
    description:
      'A demonstration community centre listing: daily prayers, Arabic classes and a Saturday youth programme.',
    categorySlug: 'mosques',
    citySlug: 'london',
    countryCode: 'GB',
    address: '120 Cannon Street Road',
    postalCode: 'E1 2LH',
    phone: '+44 20 0000 0004',
    website: 'https://example.com/bait-al-salam',
    priceLevel: 1,
    rating: 4.8,
    reviewCount: 152,
    hours: 'MOSQUE',
    tier: 'BASIC',
    deals: [],
  },

  // ── Family activities ─────────────────────────────────────────────────────
  {
    name: 'Little Explorers Amsterdam',
    slug: 'little-explorers-amsterdam',
    description:
      'Indoor play and weekend workshops for children, with a family prayer room and halal café on site.',
    categorySlug: 'family-activities',
    citySlug: 'amsterdam',
    countryCode: 'NL',
    address: 'Bos en Lommerweg 210',
    postalCode: '1055 EA',
    phone: '+31 20 000 0004',
    website: 'https://example.com/little-explorers',
    priceLevel: 2,
    rating: 4.4,
    reviewCount: 88,
    hours: 'RETAIL',
    tier: 'BASIC',
    deals: [
      {
        title: '€5 off family entry',
        description: 'Five euros off a family ticket, any weekday.',
        discountType: 'FIXED',
        discountValue: 500,
        code: 'MLPLAY5',
        terms: 'Weekdays only. One per family per visit.',
        isPremiumOnly: false,
        priority: 25,
      },
    ],
  },

  // ── Late-night food (exercises overnight opening hours) ───────────────────
  {
    name: 'Anadolu Kebab House',
    slug: 'anadolu-kebab-house-brussels',
    description:
      'Late-night grill open past midnight, popular after Isha and through the weekend. Charcoal döner, lahmacun and fresh ayran.',
    categorySlug: 'restaurants',
    citySlug: 'brussels',
    countryCode: 'BE',
    address: 'Chaussée de Haecht 88',
    postalCode: '1210',
    phone: '+32 2 000 00 06',
    website: 'https://example.com/anadolu',
    priceLevel: 1,
    rating: 4.3,
    reviewCount: 341,
    hours: 'LATE',
    tier: 'BASIC',
    deals: [
      {
        title: 'Free ayran with any grill',
        description: 'A complimentary ayran with any charcoal grill plate.',
        discountType: 'FREEBIE',
        discountValue: 0,
        terms: 'Dine in only. One per member per visit.',
        isPremiumOnly: false,
        priority: 20,
      },
    ],
  },
  {
    name: 'Night Owl Grill',
    slug: 'night-owl-grill-london',
    description:
      'Open until the small hours, seven days a week. Grilled chicken, wraps and chips for the after-Isha crowd.',
    categorySlug: 'restaurants',
    citySlug: 'london',
    countryCode: 'GB',
    address: '54 Brick Lane',
    postalCode: 'E1 6RF',
    phone: '+44 20 0000 0005',
    website: 'https://example.com/night-owl',
    priceLevel: 1,
    rating: 4.2,
    reviewCount: 512,
    hours: 'LATE',
    tier: 'BASIC',
    deals: [],
  },

  // ── Paris additions ───────────────────────────────────────────────────────
  {
    name: 'Boucherie Bellevue',
    slug: 'boucherie-bellevue-paris',
    description:
      'Halal butcher near Belleville with lamb, veal and poultry, plus prepared marinades for the weekend.',
    categorySlug: 'butchers',
    citySlug: 'paris',
    countryCode: 'FR',
    address: '18 Rue Rébeval',
    postalCode: '75019',
    phone: '+33 1 00 00 00 04',
    website: 'https://example.com/boucherie-bellevue',
    priceLevel: 2,
    rating: 4.5,
    reviewCount: 203,
    hours: 'RETAIL',
    tier: 'BASIC',
    deals: [
      {
        title: '10% off orders over €60',
        description: 'Ten percent off any order above sixty euros.',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        code: 'MLBELLE10',
        terms: 'In store only. Not valid on Eid weekends.',
        isPremiumOnly: false,
        priority: 22,
      },
    ],
  },

  // ── Amsterdam grocery ─────────────────────────────────────────────────────
  {
    name: 'Souk Supermarkt',
    slug: 'souk-supermarkt-amsterdam',
    description:
      'Turkish and Moroccan grocery: fresh produce, spices, olives and a halal meat counter at the back.',
    categorySlug: 'grocery',
    citySlug: 'amsterdam',
    countryCode: 'NL',
    address: 'Burgemeester de Vlugtlaan 125',
    postalCode: '1063 BJ',
    phone: '+31 20 000 0005',
    website: 'https://example.com/souk-supermarkt',
    priceLevel: 1,
    rating: 4.4,
    reviewCount: 267,
    hours: 'RETAIL',
    tier: 'BASIC',
    deals: [],
  },
]

export async function seedBusinesses(prisma: PrismaClient) {
  const now = new Date()
  const startsAt = new Date(now.getFullYear(), now.getMonth(), 1)
  // Deals run to the end of next month so seeded data never looks expired.
  const endsAt = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)

  for (const business of BUSINESSES) {
    const [category, city] = await Promise.all([
      prisma.businessCategory.findUnique({
        where: { slug: business.categorySlug },
        select: { id: true },
      }),
      prisma.city.findFirst({
        where: { slug: business.citySlug, country: { code: business.countryCode } },
        select: { id: true },
      }),
    ])

    if (!category || !city) {
      console.warn(`  ! Skipped ${business.name} — missing category or city`)
      continue
    }

    const record = await prisma.business.upsert({
      where: { slug: business.slug },
      create: {
        name: business.name,
        slug: business.slug,
        description: business.description,
        categoryId: category.id,
        cityId: city.id,
        address: business.address,
        postalCode: business.postalCode,
        phone: business.phone,
        website: business.website,
        openingHours: HOUR_PATTERNS[business.hours],
        priceLevel: business.priceLevel,
        // No invented social proof: a fictional listing has no real reviews,
        // so it is stored without a rating rather than with a made-up one.
        rating: null,
        reviewCount: 0,
        tier: business.tier,
        isDemo: true,
        // Seed data can NEVER be VERIFIED. A verified badge must mean a human
        // checked a real business, and a test asserts this invariant holds.
        verification: 'DEMO',
        sourceType: 'SEED',
        lastVerifiedAt: null,
        status: 'PUBLISHED',
        publishedAt: now,
      },
      update: {
        description: business.description,
        categoryId: category.id,
        cityId: city.id,
        openingHours: HOUR_PATTERNS[business.hours],
        // No invented social proof: a fictional listing has no real reviews,
        // so it is stored without a rating rather than with a made-up one.
        rating: null,
        reviewCount: 0,
        tier: business.tier,
        isDemo: true,
        verification: 'DEMO',
        sourceType: 'SEED',
        lastVerifiedAt: null,
        status: 'PUBLISHED',
      },
      select: { id: true },
    })

    for (const deal of business.deals) {
      const existing = await prisma.deal.findFirst({
        where: { businessId: record.id, title: deal.title },
        select: { id: true },
      })

      const data = {
        businessId: record.id,
        title: deal.title,
        description: deal.description,
        discountType: deal.discountType,
        discountValue: deal.discountValue,
        code: deal.code ?? null,
        terms: deal.terms,
        startsAt,
        endsAt,
        isPremiumOnly: deal.isPremiumOnly,
        priority: deal.priority,
        status: 'ACTIVE' as const,
        isDemo: true,
      }

      if (existing) {
        await prisma.deal.update({ where: { id: existing.id }, data })
      } else {
        await prisma.deal.create({ data })
      }
    }
  }

  const businesses = await prisma.business.count()
  const deals = await prisma.deal.count()
  return { businesses, deals }
}
