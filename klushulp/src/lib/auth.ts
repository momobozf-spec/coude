import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  user: {
    additionalFields: {
      // Rol wordt uitsluitend server-side gezet (registratie dienstverlener, admin-script), nooit door de client.
      platformRole: { type: "string", required: false, defaultValue: "customer", input: false, fieldName: "platformRole" },
      locale: { type: "string", required: false, defaultValue: "nl", input: false, fieldName: "locale" },
    },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  plugins: [nextCookies()],
});
