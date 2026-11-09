/**
 * Auth.js v5 configuratie.
 *
 * Twee keuzes die uitleg verdienen:
 *
 *  1. STRATEGIE = JWT, NIET DATABASE. Met de credentials-provider ondersteunt
 *     Auth.js geen database-sessies. De `Session`-tabel staat wél in het schema,
 *     zodat het toevoegen van een OAuth-provider met database-sessies later geen
 *     migratie is.
 *
 *  2. `userId` KOMT UIT DE SESSIE, NOOIT UIT DE REQUEST. Elke route haalt de
 *     gebruiker op via `requireUser()` (src/modules/auth/session.ts). Een
 *     `userId` in een body of query-parameter wordt genegeerd — dat is precies
 *     het gat waardoor multi-tenant apps andermans documenten lekken.
 */
import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import { verifyPassword } from './password'

export const credentialsSchema = z.object({
  email: z.string().email('Vul een geldig e-mailadres in'),
  password: z.string().min(8, 'Minstens 8 tekens'),
})

export const authConfig = {
  // Auth.js leest AUTH_SECRET zelf uit de omgeving; env.ts valideert dat hij
  // bestaat en lang genoeg is.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    Credentials({
      name: 'E-mail',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Wachtwoord', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          select: { id: true, email: true, name: true, image: true, passwordHash: true },
        })

        // Geen onderscheid tussen "gebruiker bestaat niet" en "wachtwoord fout":
        // dat verschil is een user-enumeration orakel. `verifyPassword` draait
        // ook zonder hash door, zodat de responstijd niet verklapt of het
        // account bestaat.
        const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? null)
        if (!ok || !user) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      // `user` is alleen gezet bij de eerste aanroep na inloggen.
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },

  trustHost: true,
} satisfies NextAuthConfig
