import fs from "node:fs";
import path from "node:path";
import { rewriteMigrationSql } from "./db-schema";

/** Kopieert de migratiemap (journal + .sql) met het app-schema in plaats van public. */
export function prepareMigrationsFolder(sourceFolder: string, schema: string, targetFolder: string): void {
  const journalPath = path.join(sourceFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  fs.mkdirSync(path.join(targetFolder, "meta"), { recursive: true });
  fs.copyFileSync(journalPath, path.join(targetFolder, "meta", "_journal.json"));
  for (const { tag } of journal.entries) {
    const sql = fs.readFileSync(path.join(sourceFolder, `${tag}.sql`), "utf8");
    fs.writeFileSync(path.join(targetFolder, `${tag}.sql`), rewriteMigrationSql(sql, schema));
  }
}
