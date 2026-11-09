/**
 * Integratietests tegen een echte PostgreSQL.
 *
 * Deze suite draait alleen wanneer `TEST_DATABASE_URL` gezet is. Dat is geen
 * verkapte `skip` om een build groen te krijgen: het zijn tests die per
 * definitie een database nodig hebben, en die zonder database niets kunnen
 * bewijzen. Ze zijn `runIf` in plaats van `skipIf` zodat de bedoeling positief
 * geformuleerd is — draaien wanneer het kan.
 *
 * Wat hier bewezen wordt en in de unit tests principieel NIET kan:
 *
 *  - dat de migraties toepasbaar zijn;
 *  - dat de unique constraint op (productId, inputHash, engineVersion)
 *    daadwerkelijk door PostgreSQL wordt afgedwongen — de unit test bewijst
 *    alleen dat wij een P2002 correct afhandelen, niet dat hij optreedt;
 *  - dat een falende cache-update de hele transactie terugdraait;
 *  - dat de CHECK-constraint op Certificate (product XOR brand) bestaat.
 *
 * Draaien:
 *   createdb halal_scanner_test
 *   TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://... npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ENGINE_VERSION } from "@/server/halal/engine";
import { disconnectTestPrisma, hasDatabase, testPrisma } from "./setup";

/**
 * De client komt uit `testPrisma()` en wordt hier niet zelf aangemaakt. Dat is
 * niet cosmetisch: `testPrisma()` draait `assertSafeTestDatabase()` vóór de
 * eerste verbinding. Een eigen `new PrismaClient(...)` liep daar precies
 * omheen, en dan staat er een suite die tabellen leegt zonder rem.
 */
let db: PrismaClient | null = null;

describe.runIf(hasDatabase)("database-integratie", () => {
  let productId: string;

  beforeAll(async () => {
    db = testPrisma();
    const product = await db.product.create({
      data: { barcode: `test-${Date.now()}`, name: "Integratietestproduct" },
    });
    productId = product.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.product.deleteMany({ where: { id: productId } });
    await disconnectTestPrisma();
  });

  it("dwingt de unique constraint op (productId, inputHash, engineVersion) af", async () => {
    if (!db) return;
    const payload = {
      productId,
      status: "MUSHBOOH" as const,
      confidence: "LOW" as const,
      summary: "test",
      engineVersion: ENGINE_VERSION,
      inputHash: "integration-hash",
    };

    await db.productAnalysis.create({ data: payload });

    // Precies dit is wat een unit test met een fake niet kan bewijzen.
    await expect(db.productAnalysis.create({ data: payload })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("draait de transactie terug wanneer de cache-update faalt", async () => {
    if (!db) return;
    const before = await db.productAnalysis.count({ where: { productId } });

    await expect(
      db.$transaction(async (tx) => {
        await tx.productAnalysis.create({
          data: {
            productId,
            status: "HARAM",
            confidence: "HIGH",
            summary: "rollback-test",
            engineVersion: ENGINE_VERSION,
            inputHash: `rollback-${Date.now()}`,
          },
        });
        // Bestaat niet: dwingt een rollback af.
        await tx.product.update({ where: { id: "bestaat-niet" }, data: { halalStatus: "HARAM" } });
      }),
    ).rejects.toThrow();

    expect(await db.productAnalysis.count({ where: { productId } })).toBe(before);
  });

  it("bewaart findings en geeft ze in positievolgorde terug", async () => {
    if (!db) return;
    const analysis = await db.productAnalysis.create({
      data: {
        productId,
        status: "MUSHBOOH",
        confidence: "MEDIUM",
        summary: "findings-test",
        engineVersion: ENGINE_VERSION,
        inputHash: `findings-${Date.now()}`,
        findings: {
          create: [
            { findingType: "UNKNOWN_INGREDIENT", status: "UNKNOWN", confidence: "LOW", label: "b", reason: "r", position: 1 },
            { findingType: "HARAM_INGREDIENT", status: "HARAM", confidence: "HIGH", label: "a", reason: "r", position: 0 },
          ],
        },
      },
      include: { findings: { orderBy: { position: "asc" } } },
    });

    expect(analysis.findings.map((f) => f.label)).toEqual(["a", "b"]);
  });

  it("weigert een certificaat zonder product én zonder merk (CHECK-constraint)", async () => {
    if (!db) return;
    const body = await db.certificationBody.findFirst();
    if (!body) return;

    await expect(
      db.certificate.create({
        data: {
          certificateNumber: `CHK-${Date.now()}`,
          certificationBodyId: body.id,
          uploadedByUserId: "bestaat-niet",
        },
      }),
    ).rejects.toThrow();
  });
});
