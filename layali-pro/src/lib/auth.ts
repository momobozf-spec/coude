import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { clientIp, forwardedForFrom, rateLimit } from "./rateLimit";

/** Na zoveel mislukte pogingen op rij gaat een account een kwartier op slot. */
export const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
/** Pogingen per IP-adres per kwartier, over alle accounts heen. */
const LOGIN_ATTEMPTS_PER_IP = 30;
/** Zo vaak wordt de rol opnieuw uit de database gelezen (een ingetrokken beheerder verliest zo snel zijn rechten). */
const ROLE_REFRESH_MS = 5 * 60 * 1000;

const INVALID = "Ongeldig e-mailadres of wachtwoord";

/** Bcrypt-hash om tegen te vergelijken als het account niet bestaat, zodat de responstijd niet verraadt of een e-mailadres bestaat. */
let dummyHash: string | null = null;
async function compareWithDummy(password: string): Promise<void> {
  dummyHash ??= await bcrypt.hash("layali-dummy-password", 12);
  await bcrypt.compare(password, dummyHash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }
  list.push(
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Wachtwoord", type: "password" },
      },
      async authorize(credentials, req) {
        const email = typeof credentials?.email === "string" ? normalizeEmail(credentials.email) : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password || password.length > 200) throw new Error(INVALID);

        const ip = clientIp(forwardedForFrom(req?.headers));
        if (!rateLimit(`login-ip:${ip}`, LOGIN_ATTEMPTS_PER_IP, 15 * 60 * 1000).allowed) {
          throw new Error("Te veel pogingen. Probeer het over een kwartier opnieuw.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) {
          await compareWithDummy(password);
          throw new Error(INVALID);
        }

        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
          throw new Error("Dit account is tijdelijk vergrendeld. Probeer het over een kwartier opnieuw.");
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data:
              attempts >= MAX_FAILED_LOGINS
                ? { failedLoginAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60 * 1000) }
                : { failedLoginAttempts: attempts },
          });
          throw new Error(INVALID);
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
  return list;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as never) as NextAuthOptions["adapter"],
  providers: providers(),
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      const now = Date.now();
      const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      if (user || now - checkedAt > ROLE_REFRESH_MS) {
        const id = user?.id ?? (token.id as string | undefined) ?? token.sub;
        const dbUser = id
          ? await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, passwordChangedAt: true } })
          : null;
        // Wachtwoord gewijzigd na het uitgeven van dit token: sessie ongeldig.
        const issuedAtMs = typeof token.iat === "number" ? token.iat * 1000 : null;
        const revoked =
          !user && issuedAtMs !== null && dbUser?.passwordChangedAt != null && issuedAtMs < dbUser.passwordChangedAt.getTime() - 1000;
        if (!dbUser || revoked) {
          // Account bestaat niet meer: sessie leeg maken.
          return { ...token, id: undefined, role: undefined, roleCheckedAt: now };
        }
        token.id = dbUser.id;
        token.role = dbUser.role;
        token.roleCheckedAt = now;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        // Geen geldige gebruiker meer achter dit token.
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: { signIn: "/nl/login" },
};
