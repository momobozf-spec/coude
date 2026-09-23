/** Deterministic helpers and reference data for the demo seed. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIRST_NAMES = ["Pieter", "Els", "Thomas", "Sofie", "Jan", "An", "Karel", "Marie", "Bart", "Lien", "Wim", "Katrien", "Tom", "Ilse", "Koen", "Nathalie", "Dirk", "Veerle", "Stijn", "Greet", "Jonas", "Lotte", "Sven", "Hanne", "Bram", "Julie", "Nadia", "Youssef", "Emma", "Louis", "Camille", "Lucas", "Noor", "Adam", "Olivia", "Arthur", "Fatima", "Mohamed", "Charlotte", "Victor"];
export const LAST_NAMES = ["Janssens", "Peeters", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet", "Vermeulen", "De Backer", "Van Damme", "Dubois", "Lambert", "Martin", "Dupont", "Lemaire", "El Amrani", "Coppens", "Coppieters", "Declercq", "Van den Broeck", "Verhaeghe", "Desmet", "Vandenberghe", "Hermans", "Aerts", "Michiels", "Pauwels", "Segers", "Van Hoof", "Cools", "Lauwers", "Bogaert", "Verstraete", "De Wilde", "Van Acker", "Moens", "Timmermans"];

export interface CityDef {
  city: string;
  postalCodes: string[];
  streets: string[];
  priceLevel: number; // base price index
}

export const CITIES: CityDef[] = [
  { city: "Gent", postalCodes: ["9000", "9030", "9040", "9050"], streets: ["Kortrijksesteenweg", "Zwijnaardsesteenweg", "Coupure Links", "Voskenslaan", "Brugsesteenweg", "Sint-Pietersnieuwstraat", "Ottergemsesteenweg", "Antwerpsesteenweg", "Dendermondsesteenweg", "Hundelgemsesteenweg", "Drongensesteenweg", "Groenestaakstraat"], priceLevel: 420000 },
  { city: "Melle", postalCodes: ["9090"], streets: ["Brusselsesteenweg", "Gontrodestraat", "Kloosterstraat"], priceLevel: 400000 },
  { city: "Merelbeke", postalCodes: ["9820"], streets: ["Hundelgemsesteenweg", "Fraterstraat", "Gaversesteenweg"], priceLevel: 430000 },
  { city: "Antwerpen", postalCodes: ["2000", "2018", "2600"], streets: ["Volkstraat", "Lange Leemstraat", "Mechelsesteenweg", "Belgiëlei", "Grotesteenweg", "Kerkstraat", "Turnhoutsebaan", "Nationalestraat"], priceLevel: 450000 },
  { city: "Brugge", postalCodes: ["8000", "8200"], streets: ["Ezelstraat", "Langestraat", "Gistelse Steenweg", "Koningin Astridlaan", "Sint-Pieterskaai", "Torhoutse Steenweg"], priceLevel: 390000 },
  { city: "Leuven", postalCodes: ["3000", "3001", "3010"], streets: ["Tiensestraat", "Naamsesteenweg", "Diestsesteenweg", "Brusselsestraat", "Geldenaaksebaan", "Tervuursevest"], priceLevel: 470000 },
  { city: "Brussel", postalCodes: ["1000", "1050", "1180"], streets: ["Rue de la Loi", "Avenue Louise", "Chaussée de Waterloo", "Rue Royale", "Avenue Brugmann", "Rue du Bailli"], priceLevel: 520000 },
];

export const PRIVATE_DESCRIPTIONS = [
  "Verkoop door particulier, zonder makelaar. Instapklare woning met zonnige tuin. Immokantoren onthouden aub.",
  "Rechtstreeks van eigenaar: lichtrijk appartement met ruim terras en kelderberging. Geen makelaars.",
  "Eigenaar verkoopt zelf. Ruime gezinswoning met 4 slaapkamers, garage en tuin. Bezoek na afspraak.",
  "Particulier à particulier, agences s'abstenir. Bel appartement rénové, proche de toutes commodités.",
  "Te koop door eigenaar. Charmante rijwoning, recent dak en nieuwe ramen. Onmiddellijk beschikbaar.",
];

export const PROFESSIONAL_DESCRIPTIONS = [
  "Aangeboden door {agency}. Contacteer ons kantoor voor een bezoek. Bekijk al onze panden op onze website.",
  "{agency} presenteert deze unieke woning. Erkend vastgoedmakelaar BIV. Ons kantoor staat klaar voor u.",
  "Exclusief bij {agency}: prachtige villa met zwembad. Plan uw bezoek via ons kantoor.",
];

export const MARKET_AGENCIES = ["Immo Vermeulen BV", "Vastgoed Coppens NV", "Era Kust Immo", "Dewaele Vastgoed", "Century Home"];

export const CONTACT_NOTES = [
  "Wil op termijn kleiner gaan wonen.",
  "Kinderen het huis uit, denkt aan verkoop binnen 2 jaar.",
  "Vroeg schatting aan i.v.m. erfenis.",
  "Niet tevreden met vorige makelaar.",
  "Bouwt nieuw, huidige woning komt vrij.",
  "Investeerder, meerdere panden.",
  "",
  "",
  "",
];
