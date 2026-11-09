/**
 * Testopzet.
 *
 * `@testing-library/jest-dom` levert matchers als `toHaveTextContent` en
 * `toHaveAttribute`. Die zijn hier waardevol omdat ze op de toegankelijke
 * representatie werken — de tekst zoals een screenreader hem ziet — in plaats
 * van op implementatiedetails van de DOM.
 *
 * ENVIRONMENT. `serverEnv()` weigert te starten zonder `DATABASE_URL`, en tot
 * nu toe kwam die waarde er per ongeluk in: een van de geïmporteerde modules
 * laadt onderweg `.env`. Dat betekende dat het slagen van een test afhing van
 * welke imports toevallig in de keten zaten — een test die alleen de OCR-laag
 * aanraakte, viel om terwijl dezelfde code in een ander bestand werkte.
 *
 * Daarom staan de waarden hier expliciet. Ze wijzen naar een database die niet
 * bestaat en niet hoeft te bestaan: de unit-suite maakt geen verbinding. Wie
 * wél tegen een echte database wil testen, gebruikt `npm run test:integration`
 * met `TEST_DATABASE_URL` — zie `tests/integration/setup.ts`.
 */
import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL ??=
  "postgresql://unit:unit@127.0.0.1:5432/halal_scanner_unit_never_connected";
