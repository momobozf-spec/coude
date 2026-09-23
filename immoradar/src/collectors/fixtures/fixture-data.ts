import type { RawListing } from "@/domain/listing/raw-listing";

/**
 * Fixture timelines. Each fixture listing has a sequence of "ticks"; the
 * collector returns the state for the requested tick, so repeated runs of the
 * pipeline naturally produce new listings, price drops, removals and relists
 * without touching any real website. `null` means the listing is absent from
 * that tick (→ removal confirmation logic kicks in).
 */
export interface FixtureTimeline {
  id: string;
  ticks: Array<Partial<RawListing> | null>;
}

const base = (over: Partial<RawListing>): Partial<RawListing> => ({
  listingType: "sale",
  currency: "EUR",
  ...over,
});

export const IMMO_PORTAL_TIMELINES: FixtureTimeline[] = [
  {
    // Scenario B: new FSBO that matches an existing CRM contact (Pieter Janssens, previous buyer 2019)
    id: "IP-1001",
    ticks: [
      base({
        title: "Charmante rijwoning met tuin — verkoop door eigenaar",
        description: "Instapklare rijwoning met 3 slaapkamers en zonnige tuin. Verkoop door particulier, zonder makelaar. Immokantoren onthouden.",
        price: "€ 625.000",
        address: "Kortrijksesteenweg 123, 9000 Gent",
        propertyType: "Rijwoning",
        bedrooms: "3",
        surfaceArea: "165 m²",
        sellerName: "Pieter Janssens",
        sellerPhone: "0478 12 34 56",
        sellerType: "particulier",
        publishedAt: "TODAY",
      }),
    ],
  },
  {
    // Scenario A: new FSBO with no CRM relationship
    id: "IP-1002",
    ticks: [
      base({
        title: "Ruim appartement met terras, rechtstreeks van eigenaar",
        description: "Lichtrijk appartement op de 2de verdieping, 2 slaapkamers, ruim terras. Geen makelaars aub.",
        price: "€ 345.000",
        address: "Coupure Links 45 bus 3, 9000 Gent",
        propertyType: "Appartement",
        bedrooms: "2",
        surfaceArea: "98 m²",
        sellerName: "Els Van Damme",
        sellerPhone: "0499 88 77 66",
        sellerType: "particulier",
        publishedAt: "TODAY",
      }),
    ],
  },
  {
    // Professional listing: should not generate FSBO opportunities
    id: "IP-2001",
    ticks: [
      base({
        title: "Villa met zwembad — Immo Vermeulen",
        description: "Prachtige villa aangeboden door Immo Vermeulen. Contacteer ons kantoor voor een bezoek. Bekijk al onze panden.",
        price: "€ 895.000",
        address: "Krijtestraat 8, 9830 Sint-Martens-Latem",
        propertyType: "Villa",
        bedrooms: "5",
        surfaceArea: "320 m²",
        sellerName: "Immo Vermeulen BV",
        sellerCompany: "Immo Vermeulen BV",
        sellerType: "agency",
        sellerListingCount: "48",
      }),
      base({
        title: "Villa met zwembad — Immo Vermeulen",
        description: "Prachtige villa aangeboden door Immo Vermeulen. Contacteer ons kantoor voor een bezoek. Bekijk al onze panden.",
        price: "€ 875.000",
        address: "Krijtestraat 8, 9830 Sint-Martens-Latem",
        propertyType: "Villa",
        bedrooms: "5",
        surfaceArea: "320 m²",
        sellerName: "Immo Vermeulen BV",
        sellerCompany: "Immo Vermeulen BV",
        sellerType: "agency",
        sellerListingCount: "48",
      }),
    ],
  },
  {
    // Price drop sequence on a private listing (tick 0 → 1 → 2), then removed, then relisted
    id: "IP-3001",
    ticks: [
      base({ title: "Halfopen bebouwing te koop door eigenaar", description: "Verkoop zonder makelaar. 4 slaapkamers, garage.", price: "510000", address: "Brusselsesteenweg 210, 9090 Melle", propertyType: "Woning", bedrooms: "4", surfaceArea: "190", sellerName: "Karel De Smet", sellerPhone: "0475 11 22 33", sellerType: "particulier" }),
      base({ title: "Halfopen bebouwing te koop door eigenaar", description: "Verkoop zonder makelaar. 4 slaapkamers, garage.", price: "495000", address: "Brusselsesteenweg 210, 9090 Melle", propertyType: "Woning", bedrooms: "4", surfaceArea: "190", sellerName: "Karel De Smet", sellerPhone: "0475 11 22 33", sellerType: "particulier" }),
      base({ title: "Halfopen bebouwing te koop door eigenaar", description: "Verkoop zonder makelaar. 4 slaapkamers, garage.", price: "475000", address: "Brusselsesteenweg 210, 9090 Melle", propertyType: "Woning", bedrooms: "4", surfaceArea: "190", sellerName: "Karel De Smet", sellerPhone: "0475 11 22 33", sellerType: "particulier" }),
      null,
      null,
      base({ title: "Halfopen bebouwing te koop door eigenaar — nieuwe prijs", description: "Verkoop zonder makelaar. 4 slaapkamers, garage.", price: "465000", address: "Brusselsesteenweg 210, 9090 Melle", propertyType: "Woning", bedrooms: "4", surfaceArea: "190", sellerName: "Karel De Smet", sellerPhone: "0475 11 22 33", sellerType: "particulier" }),
    ],
  },
  {
    // Antwerp listing: outside the Ghent agencies' territories, inside Antwerp agency's
    id: "IP-4001",
    ticks: [
      base({ title: "Loft in het Zuid — particulier", description: "Unieke loft, verkoop van particulier aan particulier.", price: "€ 520.000", address: "Volkstraat 30, 2000 Antwerpen", propertyType: "Loft", bedrooms: "2", surfaceArea: "140", sellerName: "Nadia El Amrani", sellerPhone: "0486 55 44 33", sellerType: "private" }),
    ],
  },
];

export const PRIVATE_MARKET_TIMELINES: FixtureTimeline[] = [
  {
    // Same physical property as IP-1001 on a second source → property matching must merge
    id: "PM-77",
    ticks: [
      base({
        title: "Rijwoning 3 slk Gent - eigenaar verkoopt",
        description: "Instapklare rijwoning met 3 slaapkamers en zonnige tuin, geen makelaars.",
        price: "625000",
        street: "Kortrijksesteenweg",
        houseNumber: "123",
        postalCode: 9000,
        city: "Gent",
        propertyType: "huis",
        bedrooms: 3,
        surfaceArea: 165,
        sellerPhone: "+32 478 12 34 56",
        sellerType: "private",
      }),
    ],
  },
  {
    // Agency → private transition (tick 0 professional, tick 1 private)
    id: "PM-88",
    ticks: [
      base({ title: "Bel-etage woning Brugge", description: "Aangeboden door Vastgoed Coppens. Bezoek via ons kantoor.", price: "389000", street: "Ezelstraat", houseNumber: "77", postalCode: "8000", city: "Brugge", propertyType: "huis", bedrooms: 3, surfaceArea: 150, sellerName: "Vastgoed Coppens NV", sellerCompany: "Vastgoed Coppens NV", sellerType: "agency" }),
      base({ title: "Bel-etage woning Brugge — nu rechtstreeks van eigenaar", description: "Eigenaar verkoopt zelf, zonder makelaar. Bezichtiging na afspraak.", price: "375000", street: "Ezelstraat", houseNumber: "77", postalCode: "8000", city: "Brugge", propertyType: "huis", bedrooms: 3, surfaceArea: 150, sellerName: "Marc Coppieters", sellerPhone: "050 33 44 55", sellerType: "private" }),
    ],
  },
  {
    id: "PM-99",
    ticks: [
      base({ title: "Appartement te huur Leuven", description: "Te huur: gezellig appartement, eigenaar verhuurt zelf.", listingType: "rent", price: "950", street: "Tiensestraat", houseNumber: "140", postalCode: "3000", city: "Leuven", propertyType: "appartement", bedrooms: 1, surfaceArea: 65, sellerName: "An Wouters", sellerPhone: "0470 10 20 30", sellerType: "private" }),
    ],
  },
];

/** Materialise the tick for a timeline into a RawListing, or null if absent. */
export function listingAtTick(timeline: FixtureTimeline, tick: number, now: Date, baseUrl: string): RawListing | null {
  const idx = Math.min(tick, timeline.ticks.length - 1);
  const state = timeline.ticks[idx];
  if (!state) return null;
  const publishedAt = state.publishedAt === "TODAY" ? now.toISOString() : state.publishedAt;
  return {
    sourceListingId: timeline.id,
    sourceUrl: `${baseUrl}/listing/${timeline.id}`,
    ...state,
    ...(publishedAt !== undefined ? { publishedAt } : {}),
  } as RawListing;
}
