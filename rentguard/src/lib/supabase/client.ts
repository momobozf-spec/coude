'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/supabase/types';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Supabase-client voor de browser. Gebruikt uitsluitend de anon key; RLS is
 * van kracht op elke query.
 */
export function createSupabaseBrowserClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY ontbreken. ' +
        'Zie .env.example.',
    );
  }

  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
