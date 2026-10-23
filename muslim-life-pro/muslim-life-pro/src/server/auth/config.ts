import 'server-only'

import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import { serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * Google is only registered when both credentials are present, so the UI can
 * hide the button rather than showing one that 500s.
 */
function optionalProviders() {
  const env = serverEnv()
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    return [
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: false,
      }),
    ]
  }
  return []
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),

  // JWT rather than database sessions: the middleware runs on every request and
  // must not hit Postgres to decide whether the user is signed in.
  session: { strategy: 'jwt', maxAge: 14 * 24 * 60 * 60 },

  pages: {
    signIn: '/login',
    newUser: '/onboarding',
    error: '/login',
  },

  trustHost: true,

  providers: [
    ...optionalProviders(),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const email = parsed.data.email.toLowerCase().trim()

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true,
            onboardedAt: true,
            deletedAt: true,
          },
        })

        // Compare against a dummy hash when the user is missing so that response
        // timing does not reveal whether an account exists.
        const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu'
        const valid = await bcrypt.compare(parsed.data.password, hash)

        if (!user || !user.passwordHash || !valid || user.deletedAt) {
          logger.warn('auth.credentials.rejected', { email })
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          onboarded: Boolean(user.onboardedAt),
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.onboarded = user.onboarded
        // When this session was established. Auth.js refreshes `iat` on every
        // re-encode, so it cannot be used to revoke sessions after a password
        // change; this claim is set once, at sign-in, and never moves.
        token.authAt = Math.floor(Date.now() / 1000)
      }

      // Onboarding completion and role changes must be reflected without forcing
      // the user to sign out and back in.
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, onboardedAt: true, name: true, image: true },
        })
        if (fresh) {
          token.role = fresh.role
          token.onboarded = Boolean(fresh.onboardedAt)
          token.name = fresh.name
          token.picture = fresh.image
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token.id) session.user.id = token.id
      session.user.role = token.role ?? 'USER'
      session.user.onboarded = token.onboarded ?? false
      session.user.authAt = token.authAt ?? 0
      return session
    },
  },

  events: {
    /**
     * Every user must have a Subscription and UserPreference row from the moment
     * they exist, so entitlement checks never have to handle `null`.
     */
    async createUser({ user }) {
      if (!user.id) return
      await prisma.$transaction([
        prisma.subscription.create({ data: { userId: user.id } }),
        prisma.userPreference.create({ data: { userId: user.id } }),
      ])
      logger.info('auth.user.created', { userId: user.id })
    },
  },
}
