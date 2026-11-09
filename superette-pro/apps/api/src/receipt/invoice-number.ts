import type { Prisma } from '@prisma/client';

/**
 * Trekt het volgende factuurnummer voor een winkel in een boekjaar.
 *
 * ## Waarom dit zo omslachtig is
 *
 * KB nr. 1, art. 5 eist een **doorlopende, ononderbroken** nummering. Drie voor
 * de hand liggende oplossingen falen allemaal:
 *
 *  - **Een Postgres `SEQUENCE`** verliest nummers bij een rollback. Sequences
 *    zijn met opzet niet-transactioneel: ze geven snelheid in ruil voor gaten.
 *  - **`SELECT count(*) + 1`** telt verkeerd zodra twee kassa's tegelijk
 *    afrekenen, en levert dan twee facturen met hetzelfde nummer.
 *  - **`SELECT max(nummer) + 1`** heeft precies dezelfde race.
 *
 * Wat wél werkt: één tellerrij per (winkel, jaar), vergrendeld met `FOR UPDATE`.
 * De tweede transactie wacht tot de eerste commit. Rolt de eerste terug, dan is
 * het nummer niet verbruikt.
 *
 * ## Waarom dit pas bij een geslaagde betaling gebeurt
 *
 * Een mislukte betaling mag geen factuurnummer opbranden. Vandaar dat deze
 * functie in dezelfde transactie zit als het markeren van de order als betaald,
 * en niet eerder.
 *
 * @param tx Verplicht een transactie-client — buiten een transactie doet
 *           `FOR UPDATE` niets zinnigs en verdwijnt de garantie.
 */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, storeId: string, year: number): Promise<string> {
  // Maak de tellerrij aan als dit de eerste factuur van het jaar is. `DO NOTHING`
  // zodat twee gelijktijdige eerste-facturen elkaar niet omverlopen.
  await tx.$executeRaw`
    INSERT INTO "InvoiceCounter" ("storeId", "year", "lastNumber")
    VALUES (${storeId}, ${year}, 0)
    ON CONFLICT ("storeId", "year") DO NOTHING
  `;

  // Het slot. Vanaf hier wacht elke andere transactie voor deze winkel en dit
  // jaar tot wij committen of terugrollen.
  const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
    SELECT "lastNumber"
      FROM "InvoiceCounter"
     WHERE "storeId" = ${storeId} AND "year" = ${year}
     FOR UPDATE
  `;

  const lastNumber = rows[0]?.lastNumber;
  if (lastNumber === undefined) {
    // Kan alleen als de INSERT hierboven én de SELECT allebei niets deden —
    // in de praktijk onmogelijk, maar stilzwijgend doorgaan zou een factuur
    // zonder nummer opleveren.
    throw new Error(`Factuurteller voor winkel ${storeId} in ${year} ontbreekt`);
  }

  const next = lastNumber + 1;

  await tx.$executeRaw`
    UPDATE "InvoiceCounter"
       SET "lastNumber" = ${next}
     WHERE "storeId" = ${storeId} AND "year" = ${year}
  `;

  return formatInvoiceNumber(year, next);
}

/** "JJ/2026/000042" — herkenbaar, sorteerbaar, en zichtbaar doorlopend. */
export function formatInvoiceNumber(year: number, sequence: number): string {
  return `JJ/${year}/${String(sequence).padStart(6, '0')}`;
}
