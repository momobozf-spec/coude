/**
 * Auth.js kent standaard geen `id` op `session.user`. We voegen hem toe omdat
 * het hele platform user isolation daarop baseert.
 */
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

export {}
