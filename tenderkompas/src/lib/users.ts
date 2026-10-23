import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { account, user } from "@/db/schema";
import { hashPassword } from "better-auth/crypto";

/**
 * Maakt een gebruiker aan met e-mail/wachtwoord via de wachtwoord-hashing van better-auth.
 * Publieke registratie staat uit; enkel de beheerder (of het admin-script) gebruikt dit.
 */
export async function createUserWithPassword(
  database: DB,
  input: { email: string; name: string; password: string; platformRole: "admin" | "client" },
) {
  const email = input.email.trim().toLowerCase();
  const existing = await database.query.user.findFirst({ where: eq(user.email, email) });
  if (existing) throw new Error("Er bestaat al een gebruiker met dit e-mailadres.");
  if (input.password.length < 12) throw new Error("Wachtwoord moet minstens 12 tekens bevatten.");
  const id = randomUUID();
  const hash = await hashPassword(input.password);
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx.insert(user).values({
      id,
      email,
      name: input.name,
      emailVerified: false,
      platformRole: input.platformRole,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hash,
      createdAt: now,
      updatedAt: now,
    });
  });
  return id;
}
