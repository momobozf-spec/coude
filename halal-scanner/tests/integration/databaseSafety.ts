/**
 * De rem op de integratiesuite.
 *
 * `resetTransactionalData()` doet `TRUNCATE ... CASCADE` over vrijwel elke
 * tabel. Dat is precies goed tegen een wegwerp-testdatabase en een ramp tegen
 * iets anders. De afstand tussen die twee is één omgevingsvariabele die iemand
 * uit een ander shell-venster kopieert.
 *
 * Daarom wordt hier vóór elke destructieve actie gecontroleerd, en wordt er
 * geweigerd in plaats van gewaarschuwd. Er is met opzet GEEN ontsnappingsluik
 * (`ALLOW_UNSAFE=1` of iets dergelijks): zo'n vlag wordt precies gezet op het
 * moment dat je haast hebt, en dat is het moment waarop de guard nodig is.
 *
 * De regels:
 *
 *   1. `TEST_DATABASE_URL` moet gezet zijn.
 *   2. Hij mag niet gelijk zijn aan `DATABASE_URL`.
 *   3. Hij mag niet op dezelfde host, poort én databasenaam wijzen als
 *      `DATABASE_URL` — ook niet met andere inloggegevens of query-parameters.
 *   4. De databasenaam moet herkenbaar een testdatabase zijn.
 *
 * Regel 4 is een naamconventie en geen sluitend bewijs. Dat is bewust: een
 * conventie die je met één woord in de naam volgt, is beter na te leven dan een
 * regel die niemand kan onthouden.
 */

export interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
}

/** Naampatronen die een database als wegwerpbaar aanmerken. */
const TEST_NAME_PATTERN = /(^|[_-])(test|tests|testing|ci|tmp|scratch)([_-]|$)/i;

export function parseDatabaseUrl(url: string): DatabaseTarget | null {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname.toLowerCase(),
      // Impliciete PostgreSQL-poort, zodat twee schrijfwijzen van hetzelfde
      // doelwit niet als verschillend tellen.
      port: parsed.port || "5432",
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")).toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function looksLikeTestDatabase(name: string): boolean {
  return TEST_NAME_PATTERN.test(name);
}

export function sameTarget(a: DatabaseTarget, b: DatabaseTarget): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

/**
 * Gooit met een uitleg zodra het doelwit niet veilig te legen is.
 *
 * @param testUrl  de waarde van `TEST_DATABASE_URL`
 * @param appUrl   de waarde van `DATABASE_URL`, indien gezet
 */
export function assertSafeTestDatabase(
  testUrl: string | undefined,
  appUrl: string | undefined,
): void {
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is niet gezet. De integratiesuite hoort dan overgeslagen te worden, niet gedraaid.",
    );
  }

  const target = parseDatabaseUrl(testUrl);
  if (!target || !target.database) {
    throw new Error("TEST_DATABASE_URL is geen bruikbare database-URL.");
  }

  if (appUrl && testUrl.trim() === appUrl.trim()) {
    throw new Error(
      "TEST_DATABASE_URL is identiek aan DATABASE_URL. De integratiesuite leegt tabellen; " +
        "gebruik een aparte database.",
    );
  }

  const appTarget = appUrl ? parseDatabaseUrl(appUrl) : null;
  if (appTarget && sameTarget(target, appTarget)) {
    throw new Error(
      `TEST_DATABASE_URL wijst naar dezelfde database als DATABASE_URL ` +
        `(${target.host}:${target.port}/${target.database}), alleen met andere ` +
        "verbindingsgegevens. Gebruik een aparte database.",
    );
  }

  if (!looksLikeTestDatabase(target.database)) {
    throw new Error(
      `De database "${target.database}" is niet herkenbaar als testdatabase. ` +
        'Neem "test" op in de naam (bijvoorbeeld halal_scanner_test); de integratiesuite ' +
        "leegt alle tabellen.",
    );
  }
}
