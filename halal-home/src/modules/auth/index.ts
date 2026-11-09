/**
 * De Auth.js-instantie. Eén plek, zodat `auth()`, `signIn` en `signOut` overal
 * uit dezelfde configuratie komen.
 */
import NextAuth from 'next-auth'
import { authConfig } from './config'

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
