/**
 * Compare the migrated database with prisma/schema.prisma.
 *
 * `prisma migrate diff` needs the schema-engine binary, which is not available
 * everywhere. This check needs only a database connection: every model and
 * scalar/enum field in the schema must exist as a table and column with the
 * same nullability, and every database table must belong to a model. Run after
 * applying the migrations to an EMPTY database:
 *
 *   DATABASE_URL=... npm run db:drift
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'BigInt', 'Bytes'])

interface FieldSpec {
  column: string
  nullable: boolean
  isList: boolean
}

function parseSchema(source: string): Map<string, { model: string; fields: FieldSpec[] }> {
  const enums = new Set([...source.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]!))
  const tables = new Map<string, { model: string; fields: FieldSpec[] }>()

  for (const match of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const model = match[1]!
    const body = match[2]!
    const table = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? model
    const fields: FieldSpec[] = []

    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim()
      if (!line || line.startsWith('@@')) continue
      const parts = line.split(/\s+/)
      const name = parts[0]
      const type = parts[1]
      if (!name || !type) continue
      const base = type.replace(/[?[\]]/g, '')
      if (!SCALARS.has(base) && !enums.has(base)) continue // relation field
      const column = line.match(/@map\("([^"]+)"\)/)?.[1] ?? name
      // Prisma creates list columns as nullable arrays (`TEXT[] DEFAULT ARRAY[]`)
      // and never writes NULL into them, so their nullability is not compared.
      fields.push({ column, nullable: type.endsWith('?'), isList: type.endsWith('[]') })
    }
    tables.set(table, { model, fields })
  }
  return tables
}

async function main() {
  const schema = readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
  const expected = parseSchema(schema)

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const { rows } = await client.query<{ table_name: string; column_name: string; is_nullable: 'YES' | 'NO' }>(
    `SELECT table_name, column_name, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`,
  )
  await client.end()

  const actual = new Map<string, Map<string, boolean>>()
  for (const row of rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Map())
    actual.get(row.table_name)!.set(row.column_name, row.is_nullable === 'YES')
  }

  const problems: string[] = []
  let checked = 0
  for (const [table, { model, fields }] of expected) {
    const columns = actual.get(table)
    if (!columns) {
      problems.push(`missing table ${table} (model ${model})`)
      continue
    }
    const known = new Set<string>()
    for (const field of fields) {
      checked += 1
      known.add(field.column)
      if (!columns.has(field.column)) problems.push(`missing column ${table}.${field.column}`)
      else if (!field.isList && columns.get(field.column) !== field.nullable) {
        problems.push(`nullability differs on ${table}.${field.column} (schema ${field.nullable ? 'NULL' : 'NOT NULL'})`)
      }
    }
    for (const column of columns.keys()) {
      if (!known.has(column)) problems.push(`column in database but not in schema: ${table}.${column}`)
    }
  }
  for (const table of actual.keys()) {
    if (!expected.has(table)) problems.push(`table in database but not in schema: ${table}`)
  }

  if (problems.length > 0) {
    console.error(`Schema drift (${problems.length}):\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`No drift: ${expected.size} tables, ${checked} columns match the schema.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
