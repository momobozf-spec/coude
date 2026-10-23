import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { seedClient } from "../prisma/seed-client";

/**
 * Maakt de eerste beheerder aan, of maakt een bestaand account beheerder.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=jij@voorbeeld.be npm run bootstrap:admin
 *
 * - Bestaat het account niet: het wordt aangemaakt met een tijdelijk
 *   wachtwoord dat één keer getoond wordt. Log in en wijzig het meteen.
 * - Bestaat het account al: alleen de rol wordt ADMIN; het wachtwoord blijft.
 * Idempotent: twee keer draaien verandert niets extra.
 */
const prisma = seedClient();

async function main(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Zet BOOTSTRAP_ADMIN_EMAIL op een geldig e-mailadres.");
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
      console.log(`${email} is nu beheerder. Log opnieuw in.`);
    } else {
      console.log(`${email} is al beheerder. Er is niets gewijzigd.`);
    }
    return;
  }

  const temporaryPassword = randomBytes(12).toString("base64url");
  await prisma.user.create({
    data: { email, name: "Beheerder", role: "ADMIN", password: await bcrypt.hash(temporaryPassword, 12) },
  });
  console.log(
    [
      "",
      `  Beheerder aangemaakt: ${email}`,
      `  Tijdelijk wachtwoord: ${temporaryPassword}`,
      "",
      "  Dit wordt maar één keer getoond. Log in en kies meteen een eigen wachtwoord.",
      "",
    ].join("\n"),
  );
}

main()
  .catch((e: unknown) => {
    console.error(`Bootstrap mislukt: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
