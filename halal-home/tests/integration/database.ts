/**
 * De testdatabase: een échte PostgreSQL, lokaal en wegwerpbaar.
 *
 * ─── WAAROM EEN INGEBEDDE SERVER ─────────────────────────────────────────────
 *
 * Er draait geen Docker en geen systeembrede Postgres op de ontwikkelmachine.
 * `embedded-postgres` downloadt de officiële PostgreSQL-binaries en start een
 * echte server op een eigen poort en datadirectory. Dat is geen emulatie: het
 * is dezelfde `postgres.exe` die in productie draait, dus foreign keys,
 * constraints, transacties en cascade-gedrag zijn precies wat ze werkelijk zijn.
 *
 * Een in-memory nabootsing zou hier waardeloos zijn: de hele reden dat we deze
 * suite draaien, is om te bewijzen dat de dátabase doet wat we denken.
 *
 * ─── VEILIGHEID GAAT VOOR GEMAK ──────────────────────────────────────────────
 *
 * Deze module reset databases. Voordat er iets gebeurt, controleert
 * `assertSafeTestDatabase()` dat de URL werkelijk naar een testdatabase wijst.
 * Zie de kop van die functie voor waarom elke afzonderlijke controle er staat.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'

/**
 * Vaste poort, bewust niet 5432 en niet de 5433 uit docker-compose.
 *
 * 5433 is in dit project de ontwikkeldatabase. Een testsuite die per ongeluk
 * op die poort verbindt, reset het werk van de ontwikkelaar — dus krijgt de
 * testserver een eigen poort die nergens anders voorkomt.
 */
export const TEST_PG_PORT = 54329
export const TEST_PG_USER = 'halalhome_test'
export const TEST_PG_PASSWORD = 'halalhome_test'
export const TEST_DB_NAME = 'halalhome_integration'

export function buildTestDatabaseUrl(database = TEST_DB_NAME): string {
  return `postgresql://${TEST_PG_USER}:${TEST_PG_PASSWORD}@127.0.0.1:${TEST_PG_PORT}/${database}?schema=public`
}

// ─────────────────────────────────────────────────────────────────────────────
// Veiligheid
// ─────────────────────────────────────────────────────────────────────────────

/** Namen die er verdacht productie-achtig uitzien. */
const FORBIDDEN_NAME_FRAGMENTS = [
  'production',
  'prod',
  'live',
  'staging',
  'acceptance',
  'main',
]

export class UnsafeTestDatabaseError extends Error {}

/**
 * Weigert alles wat geen wegwerpbare testdatabase is.
 *
 * Vier controles, elk voor een fout die iemand werkelijk maakt:
 *
 *   1. URL ontbreekt        — dan is er niets om veilig te noemen.
 *   2. Gelijk aan DATABASE_URL — kopiëren-plakken van de ontwikkel-URL is de
 *                            makkelijkste manier om je eigen data te wissen.
 *   3. Verdachte naam       — "prod" in een databasenaam is nooit iets dat je
 *                            wilt resetten, ook niet "per ongeluk lokaal".
 *   4. Niet-lokale host     — een testsuite hoort nooit een externe server te
 *                            resetten, ook niet met de juiste naam.
 *
 * Gooit in plaats van te waarschuwen. Een waarschuwing die je kan negeren, is
 * bij een destructieve operatie geen bescherming.
 */
export function assertSafeTestDatabase(
  url: string | undefined,
  developmentUrl: string | undefined = process.env.DATABASE_URL,
): asserts url is string {
  if (!url) {
    throw new UnsafeTestDatabaseError(
      'TEST_DATABASE_URL ontbreekt. De integratiesuite reset databases en weigert te draaien zonder expliciete testdatabase.',
    )
  }

  if (developmentUrl && normalize(url) === normalize(developmentUrl)) {
    throw new UnsafeTestDatabaseError(
      'TEST_DATABASE_URL is gelijk aan DATABASE_URL. De integratiesuite zou dan je ontwikkeldatabase wissen.',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UnsafeTestDatabaseError(`TEST_DATABASE_URL is geen geldige URL: ${url}`)
  }

  const database = parsed.pathname.replace(/^\//, '').toLowerCase()

  for (const fragment of FORBIDDEN_NAME_FRAGMENTS) {
    // Woordgrenzen, zodat "halalhome_integration" niet struikelt over "main"
    // in "domain" en "reproduction" niet over "prod".
    if (new RegExp(`(^|[_-])${fragment}([_-]|$)`).test(database)) {
      throw new UnsafeTestDatabaseError(
        `Databasenaam "${database}" bevat "${fragment}". De integratiesuite weigert databases te resetten die op een echte omgeving lijken.`,
      )
    }
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])
  if (!localHosts.has(parsed.hostname)) {
    throw new UnsafeTestDatabaseError(
      `TEST_DATABASE_URL wijst naar host "${parsed.hostname}". De integratiesuite draait alleen tegen een lokale database.`,
    )
  }
}

function normalize(url: string): string {
  return url.trim().replace(/\/$/, '').toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// De server
// ─────────────────────────────────────────────────────────────────────────────

interface RunningServer {
  instance: EmbeddedPostgres
  dataDir: string
}

let server: RunningServer | null = null

/**
 * Start de testserver, of geeft de draaiende terug.
 *
 * De datadirectory staat in de tijdelijke map van het besturingssysteem en
 * wordt bij het afsluiten weggegooid. Er blijft dus niets achter dat later
 * verwarring geeft over welke database "de echte" is.
 */
export async function startTestDatabase(): Promise<string> {
  if (server) return buildTestDatabaseUrl()

  const dataDir = await mkdtemp(path.join(tmpdir(), 'halalhome-pgdata-'))

  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: TEST_PG_USER,
    password: TEST_PG_PASSWORD,
    port: TEST_PG_PORT,
    persistent: false,
    // Geen serverlogs in de testuitvoer: die bevatten queryteksten, en daar
    // kunnen testgegevens in staan.
    onLog: () => {},
  })

  await instance.initialise()
  await instance.start()
  await instance.createDatabase(TEST_DB_NAME)

  server = { instance, dataDir }
  return buildTestDatabaseUrl()
}

export async function stopTestDatabase(): Promise<void> {
  if (!server) return

  const { instance, dataDir } = server
  server = null

  await instance.stop()
  await rm(dataDir, { recursive: true, force: true })
}

export function isTestDatabaseRunning(): boolean {
  return server !== null
}
