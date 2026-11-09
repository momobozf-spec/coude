// Grant or revoke the platform admin role.
// Usage:  node scripts/set-role.mjs <email> [admin|user]
// Uses DATABASE_URL (+ DATABASE_AUTH_TOKEN for Turso) from the environment / .env.
import "dotenv/config";
import { createClient } from "@libsql/client";

const [email, role = "admin"] = process.argv.slice(2);
if (!email || !["admin", "user"].includes(role)) {
  console.error("Usage: node scripts/set-role.mjs <email> [admin|user]");
  process.exit(1);
}

const client = createClient({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

const res = await client.execute({
  sql: "UPDATE users SET role = ? WHERE email = ?",
  args: [role, email.trim().toLowerCase()],
});
if (res.rowsAffected === 0) {
  console.error(`No user found with email ${email}. Register first, then run this script.`);
  process.exit(1);
}
console.log(`OK: ${email} now has role "${role}".`);
