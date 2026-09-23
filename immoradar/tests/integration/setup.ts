import "dotenv/config";
import { afterAll, beforeEach } from "vitest";

const testUrl = process.env["TEST_DATABASE_URL"];
if (testUrl) {
  process.env["DATABASE_URL"] = testUrl;
  process.env["LOG_LEVEL"] = "silent";
}

export const integrationEnabled = !!testUrl;

const TABLES = [
  "AuditLog", "Alert", "AlertRule", "OpportunityActivity", "OpportunityAssignment", "OpportunityScore", "OpportunitySignal", "Opportunity",
  "ContactPropertyRelationship", "CrmInteraction", "CrmImportRow", "CrmContact", "CrmImport",
  "ListingEvent", "ListingSnapshot", "Listing", "SellerIdentity", "AgencyIdentity", "Property", "CollectorRun", "Source",
  "Territory", "Session", "User", "Agency",
];

let client: import("@/generated/prisma/client").PrismaClient | null = null;

export async function testDb() {
  if (!client) {
    const { createPrismaClient } = await import("@/lib/db");
    client = createPrismaClient(testUrl);
  }
  return client;
}

export async function truncateAll(): Promise<void> {
  const db = await testDb();
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

beforeEach(async () => {
  if (integrationEnabled) await truncateAll();
});

afterAll(async () => {
  if (client) await client.$disconnect();
});
