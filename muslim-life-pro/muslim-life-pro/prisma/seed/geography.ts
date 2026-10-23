import type { PrismaClient } from '@prisma/client'

/**
 * Countries and cities.
 *
 * Coordinates are city centroids, accurate enough for prayer calculation without
 * ever asking for a GPS permission. Timezones are IANA identifiers.
 */

interface CitySeed {
  name: string
  slug: string
  latitude: number
  longitude: number
  timezone: string
}

interface CountrySeed {
  code: string
  name: string
  currency: string
  defaultLocale: string
  cities: CitySeed[]
}

export const COUNTRIES: CountrySeed[] = [
  {
    code: 'BE',
    name: 'Belgium',
    currency: 'EUR',
    defaultLocale: 'nl',
    cities: [
      { name: 'Brussels', slug: 'brussels', latitude: 50.8503, longitude: 4.3517, timezone: 'Europe/Brussels' },
      { name: 'Antwerp', slug: 'antwerp', latitude: 51.2194, longitude: 4.4025, timezone: 'Europe/Brussels' },
      { name: 'Ghent', slug: 'ghent', latitude: 51.0543, longitude: 3.7174, timezone: 'Europe/Brussels' },
      { name: 'Charleroi', slug: 'charleroi', latitude: 50.4108, longitude: 4.4446, timezone: 'Europe/Brussels' },
      { name: 'Liège', slug: 'liege', latitude: 50.6326, longitude: 5.5797, timezone: 'Europe/Brussels' },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
    defaultLocale: 'nl',
    cities: [
      { name: 'Amsterdam', slug: 'amsterdam', latitude: 52.3676, longitude: 4.9041, timezone: 'Europe/Amsterdam' },
      { name: 'Rotterdam', slug: 'rotterdam', latitude: 51.9244, longitude: 4.4777, timezone: 'Europe/Amsterdam' },
      { name: 'The Hague', slug: 'the-hague', latitude: 52.0705, longitude: 4.3007, timezone: 'Europe/Amsterdam' },
      { name: 'Utrecht', slug: 'utrecht', latitude: 52.0907, longitude: 5.1214, timezone: 'Europe/Amsterdam' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
    defaultLocale: 'fr',
    cities: [
      { name: 'Paris', slug: 'paris', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
      { name: 'Marseille', slug: 'marseille', latitude: 43.2965, longitude: 5.3698, timezone: 'Europe/Paris' },
      { name: 'Lyon', slug: 'lyon', latitude: 45.764, longitude: 4.8357, timezone: 'Europe/Paris' },
      { name: 'Lille', slug: 'lille', latitude: 50.6292, longitude: 3.0573, timezone: 'Europe/Paris' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    defaultLocale: 'en',
    cities: [
      { name: 'London', slug: 'london', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
      { name: 'Birmingham', slug: 'birmingham', latitude: 52.4862, longitude: -1.8904, timezone: 'Europe/London' },
      { name: 'Manchester', slug: 'manchester', latitude: 53.4808, longitude: -2.2426, timezone: 'Europe/London' },
      { name: 'Bradford', slug: 'bradford', latitude: 53.795, longitude: -1.7594, timezone: 'Europe/London' },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    defaultLocale: 'en',
    cities: [
      { name: 'Berlin', slug: 'berlin', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' },
      { name: 'Cologne', slug: 'cologne', latitude: 50.9375, longitude: 6.9603, timezone: 'Europe/Berlin' },
      { name: 'Frankfurt', slug: 'frankfurt', latitude: 50.1109, longitude: 8.6821, timezone: 'Europe/Berlin' },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    defaultLocale: 'en',
    cities: [
      { name: 'New York', slug: 'new-york', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
      { name: 'Chicago', slug: 'chicago', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago' },
      { name: 'Dearborn', slug: 'dearborn', latitude: 42.3223, longitude: -83.1763, timezone: 'America/Detroit' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    defaultLocale: 'en',
    cities: [
      { name: 'Toronto', slug: 'toronto', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto' },
      { name: 'Montreal', slug: 'montreal', latitude: 45.5019, longitude: -73.5674, timezone: 'America/Toronto' },
    ],
  },
  {
    code: 'TR',
    name: 'Türkiye',
    currency: 'TRY',
    defaultLocale: 'en',
    cities: [
      { name: 'Istanbul', slug: 'istanbul', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },
      { name: 'Ankara', slug: 'ankara', latitude: 39.9334, longitude: 32.8597, timezone: 'Europe/Istanbul' },
    ],
  },
  {
    code: 'MA',
    name: 'Morocco',
    currency: 'MAD',
    defaultLocale: 'fr',
    cities: [
      { name: 'Casablanca', slug: 'casablanca', latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca' },
      { name: 'Rabat', slug: 'rabat', latitude: 34.0209, longitude: -6.8416, timezone: 'Africa/Casablanca' },
      { name: 'Marrakesh', slug: 'marrakesh', latitude: 31.6295, longitude: -7.9811, timezone: 'Africa/Casablanca' },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    defaultLocale: 'en',
    cities: [
      { name: 'Dubai', slug: 'dubai', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
      { name: 'Abu Dhabi', slug: 'abu-dhabi', latitude: 24.4539, longitude: 54.3773, timezone: 'Asia/Dubai' },
    ],
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    currency: 'SAR',
    defaultLocale: 'en',
    cities: [
      { name: 'Makkah', slug: 'makkah', latitude: 21.3891, longitude: 39.8579, timezone: 'Asia/Riyadh' },
      { name: 'Madinah', slug: 'madinah', latitude: 24.5247, longitude: 39.5692, timezone: 'Asia/Riyadh' },
      { name: 'Riyadh', slug: 'riyadh', latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh' },
    ],
  },
]

export async function seedGeography(prisma: PrismaClient) {
  for (const country of COUNTRIES) {
    const record = await prisma.country.upsert({
      where: { code: country.code },
      create: {
        code: country.code,
        name: country.name,
        currency: country.currency,
        defaultLocale: country.defaultLocale,
      },
      update: { name: country.name, currency: country.currency },
      select: { id: true },
    })

    for (const city of country.cities) {
      await prisma.city.upsert({
        where: { countryId_slug: { countryId: record.id, slug: city.slug } },
        create: { ...city, countryId: record.id },
        update: {
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          timezone: city.timezone,
          isActive: true,
        },
      })
    }
  }

  const countries = await prisma.country.count()
  const cities = await prisma.city.count()
  return { countries, cities }
}
