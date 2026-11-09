import { describe, expect, it } from "vitest";
import {
  assertSafeTestDatabase,
  looksLikeTestDatabase,
  parseDatabaseUrl,
  sameTarget,
} from "./integration/databaseSafety";

/**
 * De guard zelf, zonder database.
 *
 * Deze test staat in de unit-suite en niet bij de integratietests, want juist
 * wanneer er géén testdatabase is moet bewezen zijn dat de rem werkt. Een
 * veiligheidsmaatregel die alleen getest wordt als hij al niet meer nodig is,
 * is geen maatregel.
 */

const PROD = "postgresql://app:geheim@db.productie.example.com:5432/halal_scanner";
const SAFE = "postgresql://halal:halal@localhost:5432/halal_scanner_test";

describe("URL ontleden", () => {
  it("haalt host, poort en databasenaam eruit", () => {
    expect(parseDatabaseUrl(SAFE)).toEqual({
      host: "localhost",
      port: "5432",
      database: "halal_scanner_test",
    });
  });

  it("vult de standaardpoort in zodat twee schrijfwijzen gelijk zijn", () => {
    const met = parseDatabaseUrl("postgresql://u:p@host:5432/db_test")!;
    const zonder = parseDatabaseUrl("postgresql://u:p@host/db_test")!;
    expect(sameTarget(met, zonder)).toBe(true);
  });

  it("geeft null bij iets dat geen URL is", () => {
    expect(parseDatabaseUrl("gewoon wat tekst")).toBeNull();
  });
});

describe("herkennen van een testdatabase", () => {
  it("accepteert gangbare testnamen", () => {
    for (const name of [
      "halal_scanner_test",
      "test_halal",
      "halal-scanner-test",
      "halal_ci",
      "scratch_db",
      "halal_tmp",
    ]) {
      expect(looksLikeTestDatabase(name)).toBe(true);
    }
  });

  it("accepteert een productienaam niet", () => {
    for (const name of ["halal_scanner", "postgres", "production", "halal_scanner_prod"]) {
      expect(looksLikeTestDatabase(name)).toBe(false);
    }
  });

  it("trapt niet in een naam waar 'test' toevallig in zit", () => {
    // "latest" en "contest" bevatten de letters maar zijn geen testdatabases.
    expect(looksLikeTestDatabase("latest_snapshot")).toBe(false);
    expect(looksLikeTestDatabase("contestants")).toBe(false);
  });
});

describe("de guard", () => {
  it("laat een echte testdatabase door", () => {
    expect(() => assertSafeTestDatabase(SAFE, PROD)).not.toThrow();
  });

  it("weigert wanneer TEST_DATABASE_URL ontbreekt", () => {
    expect(() => assertSafeTestDatabase(undefined, PROD)).toThrowError(/niet gezet/i);
  });

  it("weigert wanneer beide URL's identiek zijn", () => {
    expect(() => assertSafeTestDatabase(PROD, PROD)).toThrowError(/identiek/i);
  });

  it("weigert hetzelfde doelwit met andere inloggegevens", () => {
    // De valkuil waar een simpele stringvergelijking op stukgaat: ander
    // wachtwoord, andere query-parameters, zelfde database.
    const vermomd =
      "postgresql://andere_gebruiker:ander_wachtwoord@db.productie.example.com:5432/halal_scanner?sslmode=require";
    expect(() => assertSafeTestDatabase(vermomd, PROD)).toThrowError(/dezelfde database/i);
  });

  it("weigert een database die geen testnaam heeft", () => {
    const anderehost = "postgresql://u:p@localhost:5432/halal_scanner";
    expect(() => assertSafeTestDatabase(anderehost, PROD)).toThrowError(/niet herkenbaar/i);
  });

  it("weigert een onbruikbare URL", () => {
    expect(() => assertSafeTestDatabase("niet-een-url", PROD)).toThrowError(/bruikbare/i);
  });

  it("blijft eisen dat het een testdatabase is, ook zonder DATABASE_URL", () => {
    // Geen vergelijkingsmateriaal is geen vrijbrief.
    expect(() =>
      assertSafeTestDatabase("postgresql://u:p@localhost:5432/halal_scanner", undefined),
    ).toThrowError(/niet herkenbaar/i);
  });
});
