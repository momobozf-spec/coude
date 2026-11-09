/**
 * Een ontwikkeldatabase zonder Docker.
 *
 * `docker-compose.yml` blijft de bedoelde manier. Maar op een machine zonder
 * Docker kan je de app dan helemaal niet starten, en dat is een slechte reden
 * om niet te kunnen zien wat er gebouwd is.
 *
 * Dit script start een ingebedde PostgreSQL 17 op de poort uit `DATABASE_URL`,
 * met een datadirectory (`.devdb/`) die blijft bestaan. Sluit je het af en start
 * je het morgen opnieuw, dan staat je data er nog.
 *
 *   npm run dev:db      # blijft draaien tot Ctrl+C
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import 'dotenv/config'
import EmbeddedPostgres from 'embedded-postgres'

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
 * Bewust uit `DATABASE_URL` en niet uit constanten hier: lopen die twee uit
 * elkaar, dan start dit script een server waar de app niet mee praat en zoek je
 * een halve avond naar een verbindingsfout die er geen is.
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
    // host, dan is er al een database en zou dit script alleen maar de indruk
    // wekken dat het die beheert.
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

function run(command: string, args: string[]): void {
  execFileSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

async function main(): Promise<void> {
  const target = readTarget()
  const firstRun = !existsSync(DATA_DIR)

  const postgres = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: target.user,
    password: target.password,
    port: target.port,
    persistent: true,
    // UTF8 afdwingen. Zonder dit erft `initdb` op Windows de ANSI-codepagina
    // (WIN1252), en dan weigert PostgreSQL elk alertbericht — die beginnen met
    // een emoji. De officiële postgres-image draait al op UTF8, dus deze regel
    // brengt de ontwikkeldatabase in lijn met docker-compose en productie.
    initdbFlags: ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C'],
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
  const hasMigrations = existsSync(path.resolve(process.cwd(), 'prisma', 'migrations'))
  if (hasMigrations) {
    console.log('Migraties toepassen …')
    run('npx', ['prisma', 'migrate', 'deploy'])

    if (firstRun) {
      console.log('\nSeed draaien …')
      run('npx', ['tsx', 'prisma/seed.ts'])
    }
  } else {
    console.log('Nog geen migraties. Draai in een tweede terminal: npm run db:migrate')
  }

  console.log(
    [
      '',
      `PostgreSQL draait op poort ${target.port}, database "${target.database}".`,
      'Laat dit venster openstaan en start in een tweede terminal:',
      '',
      '    npm run dev        # dashboard op http://localhost:3000/admin',
      '    npm run worker     # collectors + alerts',
      '',
      'Stoppen met Ctrl+C. Je data blijft bewaard in .devdb/.',
      '',
    ].join('\n'),
  )

  // Netjes afsluiten, anders blijft er een postgres-proces hangen dat de poort
  // bezet houdt en de volgende start laat mislukken.
  let stopping = false
  const stop = async (): Promise<void> => {
    if (stopping) return
    stopping = true
    console.log('\nPostgreSQL afsluiten …')
    await postgres.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => void stop())
  process.on('SIGTERM', () => void stop())
}

main().catch((error: unknown) => {
  console.error('\nDe ontwikkeldatabase kon niet starten:')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
