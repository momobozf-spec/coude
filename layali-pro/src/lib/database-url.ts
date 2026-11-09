import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";

/**
 * Eigen Postgres-schema per app (gedeeld Supabase-project, één schema per app).
 *
 * Het schema staat als `?schema=<naam>` in DATABASE_URL, net zoals Prisma Migrate
 * het verwacht. De pg-driveradapter van Prisma 7 negeert die parameter echter:
 * zonder ingreep gaan alle queries naar `public`. Daarom:
 *
 * - de parameter gaat uit de URL voor pg en naar `PrismaPg({ schema })`, zodat
 *   modelqueries `"<schema>"."Tabel"` gebruiken;
 * - elke nieuwe poolverbinding krijgt `SET search_path`, zodat raw SQL met
 *   ongekwalificeerde namen (`$queryRaw`) ook in het app-schema terechtkomt.
 *
 * Geen `schema`-parameter (of `schema=public`): exact het oude gedrag.
 */

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

export interface DatabaseTarget {
  /** De URL zonder `schema`-parameter, voor pg. */
  connectionString: string;
  /** Het app-schema, of `undefined` voor `public`. */
  schema: string | undefined;
}

export function resolveDatabaseTarget(databaseUrl: string): DatabaseTarget {
  const queryStart = databaseUrl.indexOf("?");
  if (queryStart === -1) return { connectionString: databaseUrl, schema: undefined };

  const params = new URLSearchParams(databaseUrl.slice(queryStart + 1));
  const raw = params.get("schema");
  if (raw === null) return { connectionString: databaseUrl, schema: undefined };

  params.delete("schema");
  const rest = params.toString();
  const connectionString = databaseUrl.slice(0, queryStart) + (rest ? `?${rest}` : "");

  if (raw === "" || raw === "public") return { connectionString, schema: undefined };
  if (!SCHEMA_PATTERN.test(raw)) {
    throw new Error(
      `Ongeldige schema-naam ${JSON.stringify(raw)} in DATABASE_URL: alleen a-z, 0-9 en _, niet met een cijfer beginnen, max. 63 tekens.`,
    );
  }
  return { connectionString, schema: raw };
}

/** Alleen aangeroepen met een gevalideerde naam: er kan niets anders in staan. */
export function searchPathStatement(schema: string): string {
  return `SET search_path TO "${schema}", public`;
}

export function createPgAdapter(databaseUrl: string, poolConfig: Omit<PoolConfig, "connectionString"> = {}): PrismaPg {
  const { connectionString, schema } = resolveDatabaseTarget(databaseUrl);
  if (!schema) return new PrismaPg({ ...poolConfig, connectionString });

  const statement = searchPathStatement(schema);
  const pool = new Pool({
    ...poolConfig,
    connectionString,
    // pg-pool wacht op deze hook voordat een nieuwe verbinding wordt uitgegeven:
    // de SET loopt dus altijd vóór de eerste query. Mislukt hij, dan sluit pg-pool
    // de verbinding en krijgt de aanvrager de fout, in plaats van stil op
    // `public` verder te werken.
    onConnect: async (client) => {
      await client.query(statement);
    },
  });
  return new PrismaPg(pool, { schema, disposeExternalPool: true });
}
