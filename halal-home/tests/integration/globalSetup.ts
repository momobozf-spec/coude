/**
 * Globale opzet voor de integratiesuite.
 *
 * Draait één keer, vóór alle testbestanden:
 *
 *   1. een echte PostgreSQL starten (tenzij er al een TEST_DATABASE_URL is);
 *   2. controleren dat die database veilig te resetten is;
 *   3. alle migraties toepassen op een LEGE database.
 *
 * Stap 3 is het punt: we testen niet tegen een schema dat toevallig al bestaat,
 * maar tegen het schema zoals het uit de migraties komt. Als een migratie kapot
 * is, faalt de suite hier — en niet pas in productie.
 */
import { execFileSync } from 'node:child_process'

import {
  assertSafeTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from './database'

/** Draait een npx-commando met de testdatabase als DATABASE_URL. */
function runPrisma(args: string[], databaseUrl: string): string {
  return execFileSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
    // Prisma leest DATABASE_URL; die wijzen we hier naar de testdatabase.
    // De ontwikkel-URL wordt bewust niet doorgegeven.
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: process.platform === 'win32',
  })
}

export async function setup(): Promise<void> {
  // Een van buiten meegegeven URL wint: zo kan iemand tegen zijn eigen
  // Postgres draaien in plaats van de ingebedde.
  const external = process.env.TEST_DATABASE_URL
  const databaseUrl = external ?? (await startTestDatabase())

  // Ook een van buiten meegegeven URL gaat door de veiligheidscontrole.
  assertSafeTestDatabase(databaseUrl)

  process.env.TEST_DATABASE_URL = databaseUrl

  // ── Migraties vanaf leeg ──────────────────────────────────────────────────
  // `migrate deploy` past de migraties in volgorde toe en faalt bij een
  // kapotte migratie. Bewust niet `db push`: die zou het schema rechtstreeks
  // synchroniseren en juist verbergen of de migraties kloppen.
  try {
    runPrisma(['migrate', 'deploy'], databaseUrl)
  } catch (error) {
    const output = error instanceof Error && 'stdout' in error ? String(error.stdout) : ''
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : ''

    await stopTestDatabase()
    throw new Error(`Migraties konden niet worden toegepast:\n${output}\n${stderr}`)
  }
}

export async function teardown(): Promise<void> {
  await stopTestDatabase()
}
