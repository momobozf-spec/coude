/**
 * Certificerende instanties.
 *
 * Deze organisaties bestaan echt en geven halal-certificaten uit. Ze worden
 * hier uitsluitend geregistreerd als *uitgever* van certificaten, zodat een
 * geuploade certificaat aan de juiste instantie gekoppeld kan worden.
 *
 * `hasImportedRulings: false` betekent expliciet: wij hebben GEEN inhoudelijke
 * beoordelingen van deze instantie geimporteerd. De applicatie mag dus nooit
 * suggereren dat een ingredient "volgens JAKIM" halal of haram is, zolang die
 * vlag op false staat. Zodra een geverifieerde ruling-lijst wordt geimporteerd,
 * gaat de vlag op true en verschijnen ENumberRuling/IngredientRuling-records.
 */
export interface SeedCertificationBody {
  slug: string;
  name: string;
  country: string | null;
  website: string;
  official: boolean;
  notes: string;
}

export const seedCertificationBodies: SeedCertificationBody[] = [
  {
    slug: "jakim",
    name: "JAKIM (Jabatan Kemajuan Islam Malaysia)",
    country: "MY",
    website: "https://www.halal.gov.my",
    official: true,
    notes:
      "Overheidsinstantie van Maleisie, verantwoordelijk voor halal-certificering. Nog geen beoordelingen geimporteerd.",
  },
  {
    slug: "bpjph",
    name: "BPJPH (Badan Penyelenggara Jaminan Produk Halal)",
    country: "ID",
    website: "https://bpjph.halal.go.id",
    official: true,
    notes:
      "Indonesische overheidsinstantie voor halal-productgarantie. Nog geen beoordelingen geimporteerd.",
  },
  {
    slug: "halal-correct",
    name: "Halal Correct Certification",
    country: "NL",
    website: "https://www.halalcorrect.com",
    official: false,
    notes:
      "Nederlandse private certificeringsorganisatie. Nog geen beoordelingen geimporteerd.",
  },
  {
    slug: "hfa",
    name: "Halal Food Authority (HFA)",
    country: "GB",
    website: "https://halalfoodauthority.com",
    official: false,
    notes:
      "Britse private certificeringsorganisatie. Nog geen beoordelingen geimporteerd.",
  },
];
