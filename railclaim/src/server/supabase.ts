import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import { getEnv } from '@/lib/env'

import type { Database } from './database.types'

/**
 * Supabase clients. Two of them, and the difference matters:
 *
 *  - `getServerSupabase()` acts as the signed-in user. RLS applies. This is
 *    what every request handler and server component should use.
 *  - `getServiceRoleSupabase()` bypasses RLS entirely. Only the worker and
 *    deliberate admin operations may use it, and it must never be constructed
 *    in code that can reach a browser bundle.
 */

export type Supabase = SupabaseClient<Database>

/** User-scoped client. RLS applies — this is the default. */
export async function getServerSupabase(): Promise<Supabase> {
  const env = getEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}

let serviceRoleClient: Supabase | null = null

/**
 * Bypasses RLS. Worker and admin paths only.
 *
 * Every call site must have already established who the operation is for and
 * why RLS is being stepped over. The claims CHECK constraints still apply —
 * this client cannot confirm a claim on a user's behalf (see ADR 0001).
 */
export function getServiceRoleSupabase(): Supabase {
  if (serviceRoleClient) return serviceRoleClient

  const env = getEnv()
  serviceRoleClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return serviceRoleClient
}
