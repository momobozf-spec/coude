import 'server-only'

import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import { serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import { authenticate } from '@/server/modules/account/service'
import { clientIp, trustedProxyHops } from '@/server/http/client-ip'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * Google is only registered when both credentials are present, so the UI can hide
 * the button rather than showing one that fails.
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

  // JWT rather than database sessions: middleware runs on every request and must
  // not hit Postgres just to decide whether someone is signed in.
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  pages: {
    signIn: '/login',
    newUser: '/onboarding',
    error: '/login',
  },

  trustHost: true,

  // Een mislukte login is verwacht gedrag, geen serverfout; die logt
  // src/server/modules/account/service.ts zelf (zonder e-mailadres).
  logger: {
    error(error) {
      // `type` blijft na minificatie behouden; `name` niet.
      if ((error as { type?: string }).type === 'CredentialsSignin') return
      logger.error('auth.error', { type: (error as { type?: string }).type ?? error.name, message: error.message })
    },
  },

  providers: [
    ...optionalProviders(),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Wachtwoord', type: 'password' },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const ip = request instanceof Request ? clientIp(request.headers, trustedProxyHops()) : 'unknown'
        const user = await authenticate(parsed.data, ip)
        if (!user) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          onboarded: user.onboarded,
          sessionVersion: user.sessionVersion,
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
        // Google-logins komen via de adapter binnen zonder sessionVersion.
        token.sv =
          user.sessionVersion ??
          (
            await prisma.user.findUnique({
              where: { id: user.id as string },
              select: { sessionVersion: true },
            })
          )?.sessionVersion ??
          0
      }

      // Ingetrokken sessie (wachtwoord gewijzigd/hersteld, overal afmelden,
      // account verwijderd): null laat Auth.js de cookie wissen, zodat ook
      // /api/auth/session niets meer prijsgeeft. getActor controleert het
      // daarnaast nog eens voor elke actie.
      if (!user && token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { sessionVersion: true, deletedAt: true },
        })
        if (!current || current.deletedAt || current.sessionVersion !== (token.sv ?? 0)) {
          return null
        }
      }

      // Onboarding completion and role changes must show up without forcing the
      // user to sign out and back in.
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
      session.user.sessionVersion = token.sv ?? 0
      return session
    },
  },

  events: {
    /**
     * Every user gets a Subscription, a NotificationPreference and a ZakatProfile
     * from the moment they exist, so entitlement and calculation code never has
     * to handle `null`.
     */
    async createUser({ user }) {
      if (!user.id) return
      await provisionUser(user.id)
      logger.info('auth.user.created', { userId: user.id })
    },
  },
}

/**
 * Create the rows every user is assumed to have. Exported so that the credentials
 * registration route and the seed script provision users identically.
 */
export async function provisionUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.subscription.create({ data: { userId } }),
    prisma.notificationPreference.create({ data: { userId } }),
    prisma.zakatProfile.create({ data: { userId } }),
  ])
}
