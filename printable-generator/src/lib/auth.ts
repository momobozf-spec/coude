import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // OAuth providers are only registered when configured. No automatic account linking
    // by e-mail (allowDangerousEmailAccountLinking) — linking is handled in signIn() below
    // and only for providers that assert a verified e-mail address.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? [Apple({ clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET })]
      : []),
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? [MicrosoftEntraId({ clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET })]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers: create or link user in our database
      if (account && account.provider !== "credentials") {
        const email = user.email?.trim().toLowerCase();
        if (!email) return false;

        let dbUser = await prisma.user.findUnique({
          where: { email },
        });

        const existingLink = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { userId: true },
        });

        // Linking an OAuth identity to an EXISTING account by e-mail is only safe when the
        // provider asserts that the e-mail is verified (Google, Apple). Microsoft Entra
        // multi-tenant tokens don't guarantee that → refuse instead of risking takeover.
        if (dbUser && !existingLink) {
          const ev: unknown = profile?.email_verified;
          const verified = ev === true || ev === "true";
          if (!verified) return "/login?error=OAuthAccountNotLinked";
        }
        if (existingLink && dbUser && existingLink.userId !== dbUser.id) return false;

        if (!dbUser) {
          // Create new user from OAuth
          dbUser = await prisma.user.create({
            data: {
              name: user.name || email.split("@")[0],
              email,
              image: user.image,
              password: "", // No password for OAuth users
              // Consent text is shown next to the OAuth buttons on the register page.
              termsAcceptedAt: new Date(),
            },
          });
        } else if (user.image && !dbUser.image) {
          // Update image if missing
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { image: user.image },
          });
        }

        // Store the OAuth account link
        if (!existingLink) {
          await prisma.account.create({
            data: {
              userId: dbUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          });
        }

        // Set the user id so it flows into the JWT
        user.id = dbUser.id;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
