import { describe } from "vitest";
import { PrismaClient } from "@prisma/client";
import { assertSafeTestDatabase } from "./databaseSafety";

/**
 * Harnas voor tests die een echte PostgreSQL nodig hebben.
 *
 * Waarom geen SQLite als vervanging: precies de dingen die we hier willen
 * bewijzen - CHECK-constraints, `String[]`-kolommen, `ON DELETE`-gedrag,
 * case-insensitive `contains` - gedragen zich in SQLite anders of bestaan er
 * niet. Een groene SQLite-suite zou dus een vals gevoel van zekerheid geven.
 *
 * Draaien:
 *
 *   docker compose up -d db
 *   TEST_DATABASE_URL=postgresql://halal:halal@localhost:5432/halal_scanner_test \
 *     npm run test:integration
 *
 * Zonder `TEST_DATABASE_URL` worden deze suites overgeslagen (niet: stilzwijgend
 * geslaagd) en meldt de runner dat expliciet.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasDatabase = Boolean(TEST_DATABASE_URL);

/** `describe` die zichzelf overslaat wanneer er geen testdatabase is. */
export const describeWithDb = hasDatabase ? describe : describe.skip;

let client: PrismaClient | undefined;

export function testPrisma(): PrismaClient {
  if (!TEST_DATABASE_URL) {
    throw new Error(
      "testPrisma() aangeroepen zonder TEST_DATABASE_URL. Gebruik describeWithDb.",
    );
  }
  // Vóór de eerste verbinding, niet pas vóór de eerste TRUNCATE: dan is het
  // meteen duidelijk dat er iets aan de configuratie mankeert.
  assertSafeTestDatabase(TEST_DATABASE_URL, process.env.DATABASE_URL);

  client ??= new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
    log: ["error"],
  });
  return client;
}

export async function disconnectTestPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

/**
 * Leegt alle tabellen die de tests aanraken, in volgorde van afhankelijkheid.
 * Referentiedata (Source, ENumber, Ingredient, CertificationBody) blijft staan:
 * die komt uit de seed en is voor de tests een gegeven.
 */
export async function resetTransactionalData(): Promise<void> {
  const db = testPrisma();
  // Tweede keer, vlak voor de destructieve actie zelf: `testPrisma()` cachet
  // zijn client, dus zonder deze regel wordt de guard maar één keer per proces
  // geraakt en zou een later gewijzigde omgeving erdoor glippen.
  assertSafeTestDatabase(TEST_DATABASE_URL, process.env.DATABASE_URL);
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AnalysisFinding", "ProductAnalysis", "ProductRevision", "ProductIngredient",
      "ReviewVote", "CommunityReview", "Report", "Certificate",
      "OcrSubmission", "Favorite", "ScanEvent", "AuditLog",
      "Product", "Brand", "Session", "Account", "User"
    RESTART IDENTITY CASCADE
  `);
}
