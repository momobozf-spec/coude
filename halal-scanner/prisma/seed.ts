/**
 * Seed-script.
 *
 * Strategie:
 *  - Idempotent: alles gaat via `upsert` op een natuurlijke sleutel, zodat het
 *    script zonder schade herhaald kan worden (ook tegen een bestaande database).
 *  - Referentiedata eerst (Source, CertificationBody), daarna de data die
 *    ernaar verwijst (ENumber, Ingredient).
 *  - Er worden GEEN producten, certificaten of community-content geseed. Die
 *    ontstaan pas door echt gebruik; nepproducten met een halal-status zouden
 *    precies de schijnzekerheid creeren die we willen vermijden.
 *  - Er worden GEEN ENumberRuling/IngredientRuling-records geseed: wij hebben
 *    geen geverifieerde uitspraken van certificerende instanties geimporteerd.
 *
 * Uitbreiden met een echte bron:
 *   1. Voeg de bron toe aan prisma/seed-data/sources.ts (sourceType passend).
 *   2. Zet bij de betreffende CertificationBody `hasImportedRulings: true`.
 *   3. Voeg per E-nummer/ingredient een ruling toe met verwijzing naar die bron.
 *   Zolang stap 2 niet gebeurd is, toont de app expliciet dat er geen uitspraak
 *   van die instantie bekend is.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeIngredientName } from "../src/server/halal/normalizers/text";
import { seedSources } from "./seed-data/sources";
import { seedCertificationBodies } from "./seed-data/certification-bodies";
import { seedENumbers } from "./seed-data/e-numbers";
import { seedIngredients } from "./seed-data/ingredients";

const prisma = new PrismaClient();

async function seedSourceRecords(): Promise<Map<string, string>> {
  const byKey = new Map<string, string>();

  for (const source of seedSources) {
    const record = await prisma.source.upsert({
      where: {
        name_organization: { name: source.name, organization: source.organization },
      },
      update: {
        url: source.url,
        country: source.country,
        sourceType: source.sourceType,
        description: source.description,
        lastVerifiedAt: new Date(),
      },
      create: {
        name: source.name,
        organization: source.organization,
        url: source.url,
        country: source.country,
        sourceType: source.sourceType,
        description: source.description,
        lastVerifiedAt: new Date(),
      },
    });
    byKey.set(source.key, record.id);
  }

  console.log(`  Sources: ${byKey.size}`);
  return byKey;
}

async function seedCertificationBodyRecords(): Promise<number> {
  for (const body of seedCertificationBodies) {
    await prisma.certificationBody.upsert({
      where: { slug: body.slug },
      update: {
        name: body.name,
        country: body.country,
        website: body.website,
        official: body.official,
        notes: body.notes,
      },
      create: {
        slug: body.slug,
        name: body.name,
        country: body.country,
        website: body.website,
        official: body.official,
        active: true,
        // Bewust false: er zijn geen uitspraken van deze instantie geimporteerd.
        hasImportedRulings: false,
        notes: body.notes,
      },
    });
  }

  console.log(`  Certificeringsinstanties: ${seedCertificationBodies.length}`);
  return seedCertificationBodies.length;
}

async function seedENumberRecords(
  sourceIds: Map<string, string>,
): Promise<Map<string, string>> {
  const byCode = new Map<string, string>();

  for (const item of seedENumbers) {
    const { sourceKeys, ...data } = item;

    const record = await prisma.eNumber.upsert({
      where: { code: data.code },
      update: data,
      create: data,
    });
    byCode.set(record.code, record.id);

    for (const key of sourceKeys) {
      const sourceId = sourceIds.get(key);
      if (!sourceId) throw new Error(`Onbekende bron-key: ${key}`);

      await prisma.eNumberSource.upsert({
        where: { eNumberId_sourceId: { eNumberId: record.id, sourceId } },
        update: { retrievedAt: new Date() },
        create: { eNumberId: record.id, sourceId, retrievedAt: new Date() },
      });
    }
  }

  console.log(`  E-nummers: ${byCode.size}`);
  return byCode;
}

async function seedIngredientRecords(
  sourceIds: Map<string, string>,
  eNumberIds: Map<string, string>,
): Promise<number> {
  let aliasCount = 0;

  for (const item of seedIngredients) {
    const { aliases, sourceKeys, eNumberCode, ...data } = item;
    const normalizedName = normalizeIngredientName(data.name);

    const eNumberId = eNumberCode ? eNumberIds.get(eNumberCode) : undefined;
    if (eNumberCode && !eNumberId) {
      throw new Error(`Ingredient "${data.name}" verwijst naar onbekend E-nummer ${eNumberCode}`);
    }

    const record = await prisma.ingredient.upsert({
      where: { normalizedName },
      update: { ...data, normalizedName, eNumberId: eNumberId ?? null },
      create: { ...data, normalizedName, eNumberId: eNumberId ?? null },
    });

    for (const rawAlias of aliases) {
      const alias = normalizeIngredientName(rawAlias);
      if (!alias) continue;
      await prisma.ingredientAlias.upsert({
        where: { alias },
        update: { ingredientId: record.id },
        create: { ingredientId: record.id, alias },
      });
      aliasCount += 1;
    }

    for (const key of sourceKeys) {
      const sourceId = sourceIds.get(key);
      if (!sourceId) throw new Error(`Onbekende bron-key: ${key}`);

      await prisma.ingredientSource.upsert({
        where: { ingredientId_sourceId: { ingredientId: record.id, sourceId } },
        update: { retrievedAt: new Date() },
        create: { ingredientId: record.id, sourceId, retrievedAt: new Date() },
      });
    }
  }

  console.log(`  Ingredienten: ${seedIngredients.length} (${aliasCount} aliassen)`);
  return seedIngredients.length;
}

async function main(): Promise<void> {
  console.log("Seeding referentiedata (technische demo-dataset)...");

  const sourceIds = await seedSourceRecords();
  await seedCertificationBodyRecords();
  const eNumberIds = await seedENumberRecords(sourceIds);
  await seedIngredientRecords(sourceIds, eNumberIds);

  console.log("");
  console.log("Klaar. Let op: deze dataset is bedoeld als technische demo.");
  console.log("Er zijn geen uitspraken van halal-autoriteiten geimporteerd;");
  console.log("alle beoordelingen komen uit de interne, conservatieve regelset.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed mislukt:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
