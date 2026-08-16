/**
 * Realistic fixture scenes for the demo fixture sources. Each scene is a
 * point-in-time market state; running the pipeline repeatedly advances the
 * market (price drops, removals, relists) without touching any real website.
 */

import type { RawListing } from "@/domain/listing/types";
import { FixtureCollector } from "@/collectors/fixture-collector";

export const PORTAL_A = "fixture-portal-a";
export const PORTAL_B = "fixture-portal-b";

const base = (over: Partial<RawListing> & Pick<RawListing, "sourceListingId">): RawListing => ({
  source: PORTAL_A,
  listingType: "sale",
  currency: "EUR",
  ...over,
});

/** Scene 0: initial market. Scene 1: price movement. Scene 2: removal + relist. */
const PORTAL_A_SCENES: RawListing[][] = [
  [
    base({
      sourceListingId: "LIVE-A-001",
      title: "Instapklare rijwoning nabij Dampoort",
      description: "Verkoop door particulier, zonder makelaar. Gerenoveerde rijwoning met stadstuin.",
      price: "€ 465.000",
      address: "Spitaalpoortstraat 47, 9000 Gent",
      surfaceArea: "145 m²",
      bedrooms: "3",
      propertyType: "woning",
      sellerName: "Karel Vermeulen",
      sellerPhone: "0478 55 12 89",
      sellerKind: "particulier",
      sellerListingCount: 1,
      sourceUrl: "https://portal-a.example/listing/LIVE-A-001",
    }),
    base({
      sourceListingId: "LIVE-A-002",
      title: "Lichtrijk appartement aan het Zuidpark",
      description: "Ruim tweeslaapkamerappartement, aangeboden via Immo Deluxe.",
      price: "€ 335.000",
      address: "Woodrow Wilsonplein 3, 9000 Gent",
      surfaceArea: "98 m²",
      bedrooms: "2",
      propertyType: "appartement",
      agencyName: "Immo Deluxe",
      sellerKind: "agency",
      sourceUrl: "https://portal-a.example/listing/LIVE-A-002",
    }),
  ],
  [
    base({
      sourceListingId: "LIVE-A-001",
      title: "Instapklare rijwoning nabij Dampoort",
      description: "Verkoop door particulier, zonder makelaar. Gerenoveerde rijwoning met stadstuin.",
      price: "€ 449.000", // price drop
      address: "Spitaalpoortstraat 47, 9000 Gent",
      surfaceArea: "145 m²",
      bedrooms: "3",
      propertyType: "woning",
      sellerName: "Karel Vermeulen",
      sellerPhone: "0478 55 12 89",
      sellerKind: "particulier",
      sellerListingCount: 1,
      sourceUrl: "https://portal-a.example/listing/LIVE-A-001",
    }),
    base({
      sourceListingId: "LIVE-A-002",
      title: "Lichtrijk appartement aan het Zuidpark",
      description: "Ruim tweeslaapkamerappartement, aangeboden via Immo Deluxe.",
      price: "€ 335.000",
      address: "Woodrow Wilsonplein 3, 9000 Gent",
      surfaceArea: "98 m²",
      bedrooms: "2",
      propertyType: "appartement",
      agencyName: "Immo Deluxe",
      sellerKind: "agency",
      sourceUrl: "https://portal-a.example/listing/LIVE-A-002",
    }),
  ],
  [
    // LIVE-A-001 removed from this scene; LIVE-A-002 continues
    base({
      sourceListingId: "LIVE-A-002",
      title: "Lichtrijk appartement aan het Zuidpark",
      description: "Ruim tweeslaapkamerappartement, aangeboden via Immo Deluxe.",
      price: "€ 329.000",
      address: "Woodrow Wilsonplein 3, 9000 Gent",
      surfaceArea: "98 m²",
      bedrooms: "2",
      propertyType: "appartement",
      agencyName: "Immo Deluxe",
      sellerKind: "agency",
      sourceUrl: "https://portal-a.example/listing/LIVE-A-002",
    }),
  ],
];

const PORTAL_B_SCENES: RawListing[][] = [
  [
    {
      source: PORTAL_B,
      sourceListingId: "LIVE-B-101",
      listingType: "sale",
      title: "Charmante bel-etage te Mariakerke",
      description: "Particulier verkoopt: bel-etage met garage en zonnige tuin. Geen immokantoren.",
      price: 389000,
      street: "Eeklostraat",
      houseNumber: "112",
      postalCode: "9030",
      city: "Mariakerke",
      surfaceArea: 160,
      bedrooms: 3,
      propertyType: "woning",
      sellerName: "Griet Willems",
      sellerPhone: "0495 20 31 42",
      sellerKind: "particulier",
      sellerListingCount: 1,
      sourceUrl: "https://portal-b.example/ad/LIVE-B-101",
      currency: "EUR",
    },
  ],
];

export function demoCollectors(scene = 0): FixtureCollector[] {
  return [
    new FixtureCollector(PORTAL_A, PORTAL_A_SCENES, Math.min(scene, PORTAL_A_SCENES.length - 1)),
    new FixtureCollector(PORTAL_B, PORTAL_B_SCENES, Math.min(scene, PORTAL_B_SCENES.length - 1)),
  ];
}
