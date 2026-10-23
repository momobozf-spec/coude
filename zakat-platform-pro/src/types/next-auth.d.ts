import type { UserRole } from '@/generated/prisma/client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      onboarded: boolean
      sessionVersion: number
    } & DefaultSession['user']
  }

  interface User {
    role?: UserRole
    onboarded?: boolean
    sessionVersion?: number
  }
}

/**
 * The JWT interface is declared in `@auth/core/jwt`; `next-auth/jwt` merely
 * re-exports it, and a re-export does not participate in declaration merging.
 * Augmenting the source module is what actually applies.
 */
declare module '@auth/core/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
    onboarded?: boolean
    /** Moet gelijk zijn aan users.sessionVersion, anders is de sessie ingetrokken. */
    sv?: number
  }
}

export {}
