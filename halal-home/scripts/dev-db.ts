/**
 * Een ontwikkeldatabase, zonder Docker.
 *
 * ─── WAAROM DIT BESTAAT ──────────────────────────────────────────────────────
 *
 * `docker-compose.yml` blijft de bedoelde manier. Maar op een machine zonder
 * Docker kan je de app dan helemaal niet starten — en dat is een slechte reden
 * om niet te kunnen zien wat je gebouwd hebt.
 *
 * Dit script start dezelfde ingebedde PostgreSQL 17 als de integratiesuite, maar
 * dan op de poort uit `.env` en met een datadirectory die blíjft bestaan. Sluit
 * je het af en start je het morgen opnieuw, dan staat je data er nog.
 *
 * ─── HET VERSCHIL MET DE TESTDATABASE ────────────────────────────────────────
 *
 *   testdatabase          poort 54329, tijdelijke map, weg na afloop
 *   ontwikkeldatabase     poort uit DATABASE_URL, .devdb/, blijft staan
 *
 * Twee poorten, twee datadirectories. Ze kunnen elkaar niet raken, en de
 * integratiesuite weigert sowieso te draaien tegen een URL die gelijk is aan
 * `DATABASE_URL`.
 *
 * Draaien: npm run dev:db     (blijft draaien tot je Ctrl+C geeft)
 */
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'

/** De datadirectory staat in het project en hoort in .gitignore. */
const DATA_DIR = path.resolve(process.cwd(), '.devdb')

interface Target {
  user: string
  password: string
  port: number
  database: string
}

/**
 * Leest waar de app verwacht dat de database staat.
 *
 * Bewust uit `DATABASE_URL` en niet uit constanten hier: als die twee uit elkaar
 * lopen, start dit script een server waar de app niet mee praat, en zoek je een
 * halve avond naar een verbindingsfout die er geen is.
 */
function readTarget(): Target {
  const raw = process.env.DATABASE_URL
  if (!raw) {
    throw new Error('DATABASE_URL ontbreekt. Kopieer .env.example naar .env.')
  }

  const url = new URL(raw)
  const localHosts = new Set(['localhost', '127.0.0.1', '::1'])

  if (!localHosts.has(url.hostname)) {
    // Dit script start een lokale server. Wijst DATABASE_URL naar een externe
    // host, dan is er al een database en heeft dit script geen functie —
    // erger nog, het zou de indruk wekken dat het die host beheert.
    throw new Error(
      `DATABASE_URL wijst naar "${url.hostname}". Dit script start alleen een lokale ontwikkeldatabase.`,
    )
  }

  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ''),
  }
}

async function main(): Promise<void> {
  const target = readTarget()
  const firstRun = !existsSync(DATA_DIR)

  const postgres = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: target.user,
    password: target.password,
    port: target.port,
    // Het verschil met de testdatabase: deze blijft staan.
    persistent: true,
    onLog: () => {},
  })

  if (firstRun) {
    console.log('Eerste keer: PostgreSQL 17 klaarzetten in .devdb/ …')
    await postgres.initialise()
  }

  await postgres.start()

  if (firstRun) {
    await postgres.createDatabase(target.database)
  }

  // Migraties elke keer: goedkoop als er niets te doen is, en het voorkomt dat
  // je met een verouderd schema draait na een `git pull`.
  console.log('Migraties toepassen …')
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (firstRun) {
    console.log('\nSeed draaien …')
    execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  }

  console.log(
    [
      '',
      `PostgreSQL draait op poort ${target.port}, database "${target.database}".`,
      'Laat dit venster openstaan en start de app in een tweede terminal:',
      '',
      '    npm run dev',
      '',
      'Inloggen met dev@halalhome.local / halalhome123',
      'Stoppen met Ctrl+C. Je data blijft bewaard in .devdb/.',
      '',
    ].join('\n'),
  )

  // Netjes afsluiten, anders blijft er een postgres-proces hangen dat de poort
  // bezet houdt en de volgende start laat mislukken.
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    console.log('\nPostgreSQL afsluiten …')
    await postgres.stop()
    process.exit(0)
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((error) => {
  console.error('\nDe ontwikkeldatabase kon niet starten:')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
