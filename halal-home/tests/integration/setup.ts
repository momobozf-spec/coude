/**
 * Opzet per testbestand.
 *
 * `globalSetup` heeft op dit punt al een echte PostgreSQL gestart en de
 * migraties toegepast; `TEST_DATABASE_URL` staat dus in de omgeving. Hier
 * wijzen we `DATABASE_URL` daarheen zodat de Prisma-client van de applicatie
 * op de testdatabase uitkomt.
 *
 * `describeIfDatabase` blijft bestaan: zonder database slaan de bestanden
 * zichzelf over — zichtbaar als "skipped", niet als groen. Een test die niet
 * gedraaid heeft mag nooit als geslaagd overkomen.
 */
import { describe } from 'vitest'

import { assertSafeTestDatabase } from './database'

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

export const hasDatabase = Boolean(TEST_DATABASE_URL)

if (hasDatabase) {
  // Tweede controle, ook al deed globalSetup hem al: dit bestand kan in
  // isolatie geladen worden, en dan is er nog niets gecontroleerd.
  assertSafeTestDatabase(TEST_DATABASE_URL, undefined)
  process.env.DATABASE_URL = TEST_DATABASE_URL
}

process.env.AUTH_SECRET ??= 'integration-secret-dat-lang-genoeg-is-voor-zod-32'
process.env.STORAGE_SIGNING_SECRET ??= 'integration-signing-secret-lang-genoeg-hier'
process.env.AI_ENABLED ??= 'false'
process.env.STORAGE_PROVIDER ??= 'local'
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'

/**
 * Waar de integratietests hun bestanden neerzetten.
 *
 * Een eigen map, los van `.storage` uit de ontwikkelomgeving: de suite ruimt
 * hem op, en dat mag nooit de bestanden van een ontwikkelaar raken.
 */
process.env.STORAGE_LOCAL_DIR ??= '.storage-integration'

/** `describe` die zichzelf overslaat zonder database. */
export const describeIfDatabase: typeof describe.skip = hasDatabase ? describe : describe.skip
