/**
 * Maakt de eerste beheerder aan.
 * Gebruik: npm run admin:create -- --email jij@bedrijf.be --name "Naam"
 * Het wachtwoord wordt interactief gevraagd (niet in de shellgeschiedenis) of via ADMIN_PASSWORD.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { db, closeDb } from "@/db";
import { createUserWithPassword } from "@/lib/users";
import { ensureSources } from "@/lib/services/sources";
import { getActiveScoringConfig } from "@/lib/services/assessments";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email") ?? process.env.ADMIN_EMAIL;
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Beheerder";
  if (!email) throw new Error("Geef --email of ADMIN_EMAIL op.");
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Wachtwoord (min. 12 tekens): ");
    rl.close();
  }
  await ensureSources(db);
  await getActiveScoringConfig(db);
  const id = await createUserWithPassword(db, { email, name, password, platformRole: "admin" });
  console.log(`Beheerder aangemaakt: ${email} (${id})`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
