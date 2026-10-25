/**
 * Eigen Postgres-schema voor TenderKompas (gedeeld Supabase-project, één schema per app).
 *
 * `DATABASE_SCHEMA=<naam>` zet de app in dat schema; leeg, niet gezet of `public`
 * betekent het oude gedrag (alles in public, migratieboekhouding in `drizzle`).
 *
 * - Runtime: elke poolverbinding krijgt `SET search_path TO "<schema>", public`.
 *   De Drizzle-tabellen zijn `pgTable` zonder schema, dus elke query volgt de
 *   search_path.
 * - Migraties: de gegenereerde SQL bevat hard `"public".` (enum-types en
 *   FK-verwijzingen). scripts/migrate.ts herschrijft dat naar het app-schema
 *   (`rewriteMigrationSql`) en bewaart de boekhouding in hetzelfde schema.
 */

import type { PoolConfig } from "pg";

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

export function resolveDbSchema(value: string | undefined = process.env.DATABASE_SCHEMA): string | undefined {
  const name = value?.trim() ?? "";
  if (name === "" || name === "public") return undefined;
  if (!SCHEMA_PATTERN.test(name)) {
    throw new Error(
      `Ongeldige DATABASE_SCHEMA ${JSON.stringify(name)}: alleen a-z, 0-9 en _, niet met een cijfer beginnen, max. 63 tekens.`,
    );
  }
  return name;
}

/** Alleen aangeroepen met een gevalideerde naam: er kan niets anders in staan. */
export function searchPathStatement(schema: string): string {
  return `SET search_path TO "${schema}", public`;
}

/**
 * Pool-instellingen; met een app-schema krijgt elke nieuwe verbinding eerst de
 * search_path. pg-pool wacht op `onConnect` voordat de verbinding wordt
 * uitgegeven; mislukt de SET, dan sluit pg-pool de verbinding en krijgt de
 * aanvrager de fout, in plaats van stil op public verder te werken.
 */
export function poolConfig(connectionString: string, max: number, schema = resolveDbSchema()): PoolConfig {
  if (!schema) return { connectionString, max };
  const statement = searchPathStatement(schema);
  return {
    connectionString,
    max,
    onConnect: async (client) => {
      await client.query(statement);
    },
  };
}

/** Vervangt elke `"public".`-kwalificatie in een drizzle-kit-migratie door het app-schema. */
export function rewriteMigrationSql(sql: string, schema: string): string {
  return sql.replaceAll('"public".', `"${schema}".`);
}
