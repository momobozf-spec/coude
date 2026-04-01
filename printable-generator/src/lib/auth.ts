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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Apple({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    MicrosoftEntraId({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
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
    async signIn({ user, account }) {
      // For OAuth providers: create or link user in our database
      if (account && account.provider !== "credentials") {
        const email = user.email;
        if (!email) return false;

        let dbUser = await prisma.user.findUnique({
          where: { email },
        });

        if (!dbUser) {
          // Create new user from OAuth
          dbUser = await prisma.user.create({
            data: {
              name: user.name || email.split("@")[0],
              email,
              image: user.image,
              password: "", // No password for OAuth users
            },
          });
        } else if (user.image && !dbUser.image) {
          // Update image if missing
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { image: user.image },
          });
        }

        // Store/update the OAuth account link
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
        });

        if (!existingAccount) {
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
