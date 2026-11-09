import type { User } from '@supabase/supabase-js'
import { headers } from 'next/headers'

import { getServerSupabase } from './supabase'

/** The signed-in user, or null. Never throws. */
export async function getUser(): Promise<User | null> {
  const supabase = await getServerSupabase()
  // getUser() revalidates the JWT against Supabase. getSession() does not and
  // is forgeable from a cookie, so it must not be used for authorisation.
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Authentication required')
    this.name = 'UnauthorizedError'
  }
}

export async function requireUser(): Promise<User> {
  const user = await getUser()
  if (!user) throw new UnauthorizedError()
  return user
}

/** Admin check, answered by the database (SECURITY DEFINER is_admin()). */
export async function isAdmin(): Promise<boolean> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return data === true
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (!(await isAdmin())) throw new UnauthorizedError()
  return user
}

/**
 * Client IP, recorded alongside every claim confirmation and mandate as proof
 * of consent.
 *
 * Behind a proxy the socket address is the proxy's, so we read the standard
 * forwarding headers. The leftmost entry of `x-forwarded-for` is the client.
 * These headers are spoofable by the client, which is acceptable here: this is
 * evidence about a consent event, not an authorisation input.
 */
export async function getClientIp(): Promise<string | null> {
  const headerList = await headers()

  const forwarded = headerList.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return headerList.get('x-real-ip') ?? headerList.get('cf-connecting-ip') ?? null
}
