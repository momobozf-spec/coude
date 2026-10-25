import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { poolConfig, resolveDbSchema, rewriteMigrationSql, searchPathStatement } from "@/db/db-schema";
import { prepareMigrationsFolder } from "@/db/migrations-folder";

describe("resolveDbSchema", () => {
  it("geeft undefined zonder waarde, leeg of public (oud gedrag)", () => {
    expect(resolveDbSchema(undefined)).toBeUndefined();
    expect(resolveDbSchema("")).toBeUndefined();
    expect(resolveDbSchema("  ")).toBeUndefined();
    expect(resolveDbSchema("public")).toBeUndefined();
  });

  it("aanvaardt een geldige naam", () => {
    expect(resolveDbSchema("tenderkompas")).toBe("tenderkompas");
    expect(resolveDbSchema(" tender_kompas2 ")).toBe("tender_kompas2");
    expect(resolveDbSchema(`_${"a".repeat(62)}`)).toBe(`_${"a".repeat(62)}`);
  });

  it.each(["TenderKompas", "1tk", "tender-kompas", 'tk"; DROP SCHEMA public; --', "x".repeat(64), "tender kompas"])(
    "weigert %j",
    (name) => {
      expect(() => resolveDbSchema(name)).toThrow(/Ongeldige DATABASE_SCHEMA/);
    },
  );
});

describe("searchPathStatement / poolConfig", () => {
  it("zet het app-schema vóór public", () => {
    expect(searchPathStatement("tenderkompas")).toBe('SET search_path TO "tenderkompas", public');
  });

  it("laat de pool ongemoeid zonder schema", () => {
    expect(poolConfig("postgres://x", 10, undefined)).toEqual({ connectionString: "postgres://x", max: 10 });
  });

  it("zet search_path bij elke nieuwe verbinding met schema", async () => {
    const config = poolConfig("postgres://x", 1, "tenderkompas");
    const queries: string[] = [];
    const client = { query: async (sql: string) => void queries.push(sql) };
    await config.onConnect!(client as never);
    expect(queries).toEqual(['SET search_path TO "tenderkompas", public']);
  });
});

describe("rewriteMigrationSql", () => {
  it("herschrijft enum-types en FK-verwijzingen naar het app-schema", () => {
    const sql = [
      `CREATE TYPE "public"."subscription_status" AS ENUM('lead', 'pilot');--> statement-breakpoint`,
      `ALTER TABLE "account" ADD CONSTRAINT "fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade;`,
    ].join("\n");
    const out = rewriteMigrationSql(sql, "tenderkompas");
    expect(out).toContain(`CREATE TYPE "tenderkompas"."subscription_status"`);
    expect(out).toContain(`REFERENCES "tenderkompas"."user"("id")`);
    expect(out).not.toContain(`"public".`);
    expect(out).toContain("--> statement-breakpoint");
  });

  it("laat ongekwalificeerde namen en andere tekst staan", () => {
    const sql = `CREATE TABLE "public_notice" ("visibility" text DEFAULT 'public');`;
    expect(rewriteMigrationSql(sql, "tenderkompas")).toBe(sql);
  });

  it("laat in de echte migraties geen enkele public-kwalificatie over", () => {
    const folder = path.resolve(import.meta.dirname, "../../drizzle");
    for (const file of fs.readdirSync(folder).filter((f) => f.endsWith(".sql"))) {
      const out = rewriteMigrationSql(fs.readFileSync(path.join(folder, file), "utf8"), "tenderkompas");
      expect(out, file).not.toMatch(/"public"\s*\./);
      expect(out, file).not.toMatch(/\bpublic\./);
    }
  });
});

describe("prepareMigrationsFolder", () => {
  let tmp: string | undefined;
  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = undefined;
  });

  it("kopieert journal en alle migraties, herschreven", () => {
    const source = path.resolve(import.meta.dirname, "../../drizzle");
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tk-test-"));
    prepareMigrationsFolder(source, "tenderkompas", tmp);

    const journal = JSON.parse(fs.readFileSync(path.join(source, "meta", "_journal.json"), "utf8")) as {
      entries: { tag: string }[];
    };
    expect(fs.readFileSync(path.join(tmp, "meta", "_journal.json"), "utf8")).toBe(
      fs.readFileSync(path.join(source, "meta", "_journal.json"), "utf8"),
    );
    for (const { tag } of journal.entries) {
      const original = fs.readFileSync(path.join(source, `${tag}.sql`), "utf8");
      expect(fs.readFileSync(path.join(tmp, `${tag}.sql`), "utf8")).toBe(rewriteMigrationSql(original, "tenderkompas"));
    }
  });
});
