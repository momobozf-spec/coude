/** Maakt (of promoveert) de beheerder: ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD uit de omgeving. */
import "dotenv/config";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME ?? "Beheerder";
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error("ADMIN_EMAIL en ADMIN_PASSWORD (min. 12 tekens) zijn vereist.");
  const { auth } = await import("../src/lib/auth");
  const { db, schema } = await import("../src/db");
  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (!existing) {
    await auth.api.signUpEmail({ body: { name, email, password } });
  }
  await db.update(schema.user).set({ platformRole: "admin", updatedAt: new Date() }).where(eq(schema.user.email, email));
  console.log(`Beheerder: ${email}`);
  const { pool } = await import("../src/db");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
