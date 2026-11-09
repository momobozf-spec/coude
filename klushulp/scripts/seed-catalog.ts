/**
 * Catalogus: regio's, gemeenten en categorieën. Idempotent; mag in productie draaien.
 *
 * Gemeentecoördinaten zijn benaderende centroïden (±1 km), voldoende voor werkgebied-matching op straal.
 * Vóór publieke lancering vervangen door een officiële dataset (bpost postcodes + GeoNames/Statbel-centroïden).
 */
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

type Muni = [postcode: string, nameNl: string, nameFr: string, lat: number, lng: number];

const ANTWERPEN: Muni[] = [
  ["2000", "Antwerpen", "Anvers", 51.2194, 4.4025],
  ["2018", "Antwerpen", "Anvers", 51.207, 4.41],
  ["2020", "Antwerpen", "Anvers", 51.195, 4.388],
  ["2030", "Antwerpen", "Anvers", 51.26, 4.4],
  ["2040", "Berendrecht-Zandvliet-Lillo", "Berendrecht-Zandvliet-Lillo", 51.34, 4.31],
  ["2050", "Antwerpen", "Anvers", 51.22, 4.37],
  ["2060", "Antwerpen", "Anvers", 51.229, 4.43],
  ["2070", "Zwijndrecht", "Zwijndrecht", 51.219, 4.329],
  ["2100", "Deurne", "Deurne", 51.223, 4.465],
  ["2110", "Wijnegem", "Wijnegem", 51.228, 4.52],
  ["2140", "Borgerhout", "Borgerhout", 51.212, 4.437],
  ["2150", "Borsbeek", "Borsbeek", 51.198, 4.485],
  ["2160", "Wommelgem", "Wommelgem", 51.203, 4.52],
  ["2170", "Merksem", "Merksem", 51.243, 4.445],
  ["2180", "Ekeren", "Ekeren", 51.28, 4.42],
  ["2500", "Lier", "Lierre", 51.131, 4.57],
  ["2520", "Ranst", "Ranst", 51.19, 4.563],
  ["2530", "Boechout", "Boechout", 51.16, 4.495],
  ["2540", "Hove", "Hove", 51.153, 4.475],
  ["2547", "Lint", "Lint", 51.127, 4.491],
  ["2550", "Kontich", "Kontich", 51.133, 4.448],
  ["2570", "Duffel", "Duffel", 51.096, 4.508],
  ["2600", "Berchem", "Berchem", 51.196, 4.431],
  ["2610", "Wilrijk", "Wilrijk", 51.168, 4.395],
  ["2620", "Hemiksem", "Hemiksem", 51.144, 4.34],
  ["2627", "Schelle", "Schelle", 51.126, 4.34],
  ["2630", "Aartselaar", "Aartselaar", 51.134, 4.385],
  ["2640", "Mortsel", "Mortsel", 51.17, 4.456],
  ["2650", "Edegem", "Edegem", 51.156, 4.444],
  ["2660", "Hoboken", "Hoboken", 51.175, 4.348],
  ["2845", "Niel", "Niel", 51.11, 4.333],
  ["2850", "Boom", "Boom", 51.092, 4.366],
  ["2900", "Schoten", "Schoten", 51.253, 4.5],
  ["2930", "Brasschaat", "Brasschaat", 51.291, 4.492],
  ["2950", "Kapellen", "Kapellen", 51.314, 4.431],
  ["2960", "Brecht", "Brecht", 51.35, 4.638],
  ["2970", "Schilde", "Schilde", 51.24, 4.58],
  ["2980", "Zoersel", "Zoersel", 51.264, 4.711],
  ["2990", "Wuustwezel", "Wuustwezel", 51.392, 4.596],
];

const CATEGORIES: (typeof schema.category.$inferInsert)[] = [
  {
    slug: "plumbing",
    nameNl: "Loodgieter",
    nameFr: "Plombier",
    descriptionNl: "Lekken, kranen, afvoer, sanitair, boiler.",
    descriptionFr: "Fuites, robinets, évacuations, sanitaire, chauffe-eau.",
    allowedProviderTypes: ["professional"],
    requiredVerifications: ["kbo"],
    keywords: ["lek", "lekt", "kraan", "afvoer", "verstopt", "verstopping", "toilet", "wc", "sanitair", "boiler", "douche", "bad", "sifon", "leiding", "water", "loodgieter", "fuite", "robinet", "plomb", "évacuation", "bouché", "chauffe-eau"],
    followupQuestions: [
      {
        key: "problem",
        type: "choice",
        labelNl: "Wat is het vooral?",
        labelFr: "De quoi s'agit-il surtout ?",
        options: [
          { value: "leak", nl: "Lek of waterschade", fr: "Fuite ou dégât des eaux" },
          { value: "blocked", nl: "Verstopping", fr: "Bouchon" },
          { value: "install", nl: "Plaatsen of vervangen", fr: "Installation ou remplacement" },
          { value: "heating", nl: "Boiler of verwarming", fr: "Chauffe-eau ou chauffage" },
          { value: "other", nl: "Iets anders", fr: "Autre chose" },
        ],
      },
      {
        key: "water_off",
        type: "choice",
        labelNl: "Is het water nu afgesloten?",
        labelFr: "L'eau est-elle coupée actuellement ?",
        options: [
          { value: "yes", nl: "Ja", fr: "Oui" },
          { value: "no", nl: "Nee", fr: "Non" },
          { value: "na", nl: "Niet van toepassing", fr: "Sans objet" },
        ],
      },
    ],
    sortOrder: 1,
  },
  {
    slug: "electrical",
    nameNl: "Elektricien",
    nameFr: "Électricien",
    descriptionNl: "Stopcontacten, verlichting, zekeringkast, storingen, laadpaal.",
    descriptionFr: "Prises, éclairage, tableau électrique, pannes, borne de recharge.",
    allowedProviderTypes: ["professional"],
    requiredVerifications: ["kbo"],
    keywords: ["stopcontact", "stroom", "zekering", "zekeringkast", "verlichting", "lamp", "schakelaar", "elektr", "kortsluiting", "laadpaal", "bekabeling", "keuring", "prise", "courant", "disjoncteur", "électr", "éclairage", "interrupteur", "borne"],
    followupQuestions: [
      {
        key: "problem",
        type: "choice",
        labelNl: "Wat is het vooral?",
        labelFr: "De quoi s'agit-il surtout ?",
        options: [
          { value: "outage", nl: "Geen stroom of storing", fr: "Panne ou coupure" },
          { value: "install", nl: "Stopcontact, schakelaar of verlichting plaatsen", fr: "Installer prise, interrupteur ou éclairage" },
          { value: "board", nl: "Zekeringkast of keuring", fr: "Tableau électrique ou contrôle" },
          { value: "charger", nl: "Laadpaal", fr: "Borne de recharge" },
          { value: "other", nl: "Iets anders", fr: "Autre chose" },
        ],
      },
    ],
    sortOrder: 2,
  },
  {
    slug: "handyman",
    nameNl: "Klushulp",
    nameFr: "Bricolage",
    descriptionNl: "Montage, ophangen, kleine herstellingen.",
    descriptionFr: "Montage, fixation, petites réparations.",
    // Fase 1: ook klushulp enkel door ondernemingen (zie README: deeleconomie-erkenning).
    allowedProviderTypes: ["professional"],
    requiredVerifications: ["kbo"],
    keywords: ["monteren", "montage", "kast", "ikea", "ophangen", "boren", "gordijn", "rail", "tv", "lijst", "plank", "herstellen", "klus", "deur", "slot", "kit", "silicone", "meuble", "monter", "fixer", "percer", "étagère", "porte", "bricol"],
    followupQuestions: [
      {
        key: "kind",
        type: "choice",
        labelNl: "Wat voor klus?",
        labelFr: "Quel type de travail ?",
        options: [
          { value: "assembly", nl: "Meubel monteren", fr: "Monter un meuble" },
          { value: "mount", nl: "Iets ophangen (tv, kast, gordijnrail)", fr: "Fixer quelque chose (TV, armoire, rail)" },
          { value: "repair", nl: "Kleine herstelling", fr: "Petite réparation" },
          { value: "other", nl: "Iets anders", fr: "Autre chose" },
        ],
      },
      {
        key: "materials",
        type: "choice",
        labelNl: "Heb je het materiaal al in huis?",
        labelFr: "Avez-vous déjà le matériel ?",
        options: [
          { value: "yes", nl: "Ja", fr: "Oui" },
          { value: "no", nl: "Nee", fr: "Non" },
        ],
      },
    ],
    sortOrder: 3,
  },
];

export async function seedCatalog(db: ReturnType<typeof drizzle>) {
  const [existing] = await db.select().from(schema.region).where(eq(schema.region.slug, "antwerpen")).limit(1);
  const [reg] = existing
    ? [existing]
    : await db.insert(schema.region).values({ slug: "antwerpen", nameNl: "Antwerpen", nameFr: "Anvers", active: true }).returning();
  for (const [postcode, nameNl, nameFr, lat, lng] of ANTWERPEN) {
    await db
      .insert(schema.municipality)
      .values({ postcode, nameNl, nameFr, regionId: reg.id, lat, lng })
      .onConflictDoUpdate({ target: [schema.municipality.postcode, schema.municipality.nameNl], set: { lat, lng, nameFr, regionId: reg.id } });
  }
  for (const c of CATEGORIES) {
    await db
      .insert(schema.category)
      .values(c)
      .onConflictDoUpdate({
        target: schema.category.slug,
        set: {
          nameNl: c.nameNl,
          nameFr: c.nameFr,
          descriptionNl: c.descriptionNl,
          descriptionFr: c.descriptionFr,
          allowedProviderTypes: c.allowedProviderTypes,
          requiredVerifications: c.requiredVerifications,
          keywords: c.keywords,
          followupQuestions: c.followupQuestions,
          sortOrder: c.sortOrder,
        },
      });
  }
  return { region: reg, municipalities: ANTWERPEN.length, categories: CATEGORIES.length };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const r = await seedCatalog(db);
  console.log(`Catalogus: regio ${r.region.nameNl}, ${r.municipalities} gemeenten, ${r.categories} categorieën.`);
  await pool.end();
}

if (process.argv[1]?.endsWith("seed-catalog.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
