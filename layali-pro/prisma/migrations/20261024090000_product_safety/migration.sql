-- Productveiligheid: GPSR (EU 2023/988) en CLP (EG 1272/2008) voor kaarsen,
-- wierook en huisparfum. Alle velden optioneel; het beheer weigert een actief
-- product in een veiligheidsgevoelige categorie zonder deze gegevens.
ALTER TABLE "Product" ADD COLUMN "safetyInfo" TEXT;
ALTER TABLE "Product" ADD COLUMN "safetyInfoFr" TEXT;
ALTER TABLE "Product" ADD COLUMN "hazardPictograms" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN "manufacturerInfo" TEXT;
ALTER TABLE "Product" ADD COLUMN "euResponsiblePerson" TEXT;
