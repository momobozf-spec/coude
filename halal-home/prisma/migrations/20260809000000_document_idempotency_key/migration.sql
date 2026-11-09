-- Echte upload-idempotentie.
--
-- Tot nu toe detecteerde alleen de sha256-checksum een dubbele upload, en die
-- detectie was informatief: hij blokkeerde niets. Dat is bewust — twee
-- byte-identieke loonfiches mogen allebei bestaan — maar het betekende dat een
-- dubbel verzonden formulier wél twee documenten opleverde.
--
-- De client stuurt nu een sleutel mee die één handeling identificeert. NULL is
-- toegestaan: PostgreSQL beschouwt NULL-waarden in een unique index als
-- onderling verschillend, dus uploads zonder sleutel botsen nooit.

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_userId_idempotencyKey_key" ON "Document"("userId", "idempotencyKey");
