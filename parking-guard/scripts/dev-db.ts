/**
 * Een echte PostgreSQL voor ontwikkeling, zonder Docker.
 *
 * Deze machine heeft geen Docker en geen psql (zie docs/module-bewonerskaart/PLAN.md,
 * §1.4). `embedded-postgres` pakt een echte PostgreSQL-binary uit in `.devdb/` en
 * start die op een eigen poort — dezelfde database-engine als in productie,
 * zonder installatie.
 *
 * Poort 5434 en niet 5432 of 5433: 5432 is de standaardpoort van een lokaal
 * geïnstalleerde PostgreSQL, en 5433 draait al voor een buurproject in deze
 * werkruimte. Een eigen poort voorkomt dat je stilletjes met de verkeerde
 * database praat.
 *
 * Draai `npm run dev:db` in een eigen terminal en laat hem staan. Ctrl-C stopt
 * hem netjes; de data in `.devdb/` blijft.
 */
import path from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'

const DATABASE_DIR = path.resolve(process.cwd(), '.devdb')
const PORT = 5434
const USER = 'postgres'
const PASSWORD = 'postgres'
const DATABASE = 'parkingguard'

const CONNECTION_STRING = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public`

async function main(): Promise<void> {
  const postgres = new EmbeddedPostgres({
    databaseDir: DATABASE_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    /**
     * Zonder deze vlaggen neemt `initdb` de systeemlocale over. Op een
     * Nederlandstalige Windows levert dat een WIN1252-cluster op, en dan breekt
     * de eerste de beste `Liège`, `Sint-Agatha-Berchem` of een adres met een
     * accent met "no equivalent in encoding WIN1252". In een tweetalig Brussels
     * product is UTF-8 geen voorkeur maar een vereiste.
     *
     * `--locale=C` erbij omdat initdb een UTF-8-encoding met een 1252-locale
     * weigert. Sorteervolgorde speelt geen rol: wat op volgorde moet, wordt in
     * de applicatie genormaliseerd.
     */
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })

  // Op een bestaande datamap slaat `initialise` over. De melding verschilt per
  // platform, vandaar de ruime match.
  try {
    await postgres.initialise()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/exists|not empty|already/i.test(message)) throw error
  }

  await postgres.start()

  try {
    await postgres.createDatabase(DATABASE)
    process.stdout.write(`Database "${DATABASE}" aangemaakt.\n`)
  } catch {
    // Bestond al — het normale geval bij de tweede start.
  }

  process.stdout.write(
    [
      '',
      '  PostgreSQL draait.',
      '',
      '  Zet dit in je .env:',
      '',
      `  DATABASE_URL="${CONNECTION_STRING}"`,
      '',
      '  Daarna, in een tweede terminal:',
      '',
      '    npm run db:migrate',
      '    npm run db:seed',
      '    npm run dev',
      '',
      '  Ctrl-C stopt de database.',
      '',
      '',
    ].join('\n'),
  )

  const shutdown = async (): Promise<void> => {
    process.stdout.write('\nDatabase stoppen…\n')
    try {
      await postgres.stop()
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())

  await new Promise<never>(() => {})
}

main().catch((error: unknown) => {
  process.stderr.write(`Kon de ontwikkeldatabase niet starten: ${String(error)}\n`)
  process.exit(1)
})
