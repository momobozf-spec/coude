-- Fase 3: analyse-hergebruik en menselijke verificatie.
--
-- Twee wijzigingen aan ProductAnalysis:
--
--  1. needsHumanReview als eigen kolom. Nu altijd gelijk aan hasConflict, maar
--     de moderatiewachtrij filtert hierop en de redenen om review te vragen
--     kunnen groeien zonder dat bestaande analyses herrekend hoeven te worden.
--
--  2. Een unieke index op (productId, inputHash, engineVersion). Dit is de
--     enige echte bescherming tegen dubbele analyses bij gelijktijdige
--     requests: een check-then-insert in applicatiecode houdt altijd een venster
--     open tussen de check en de insert. De verliezende transactie vangt de
--     unique violation op en leest het bestaande record terug — dat is veilig,
--     want dezelfde hash betekent per definitie dezelfde uitkomst.
--
-- LET OP: deze migratie is geschreven tegen het Prisma-schema maar niet
-- uitgevoerd tegen een draaiende PostgreSQL. Zie docs/ARCHITECTURE.md en het
-- eindrapport; de integratiesuite achter TEST_DATABASE_URL is bedoeld om dit
-- alsnog te bewijzen.

ALTER TABLE "ProductAnalysis"
  ADD COLUMN "needsHumanReview" BOOLEAN NOT NULL DEFAULT false;

-- Bestaande analyses: een conflict betekende ook toen al dat er een mens naar
-- moest kijken. Zo blijft de wachtrij consistent met de historie.
UPDATE "ProductAnalysis" SET "needsHumanReview" = true WHERE "hasConflict" = true;

-- Eventuele dubbele analyses uit de periode vóór deze constraint opruimen,
-- anders faalt het aanmaken van de unieke index. De oudste blijft staan: dat is
-- de analyse waar eventuele findings en verwijzingen al aan hangen.
DELETE FROM "ProductAnalysis" a
USING "ProductAnalysis" b
WHERE a."productId" = b."productId"
  AND a."inputHash" = b."inputHash"
  AND a."engineVersion" = b."engineVersion"
  AND a."createdAt" > b."createdAt";

CREATE UNIQUE INDEX "ProductAnalysis_productId_inputHash_engineVersion_key"
  ON "ProductAnalysis" ("productId", "inputHash", "engineVersion");

CREATE INDEX "ProductAnalysis_needsHumanReview_createdAt_idx"
  ON "ProductAnalysis" ("needsHumanReview", "createdAt");
