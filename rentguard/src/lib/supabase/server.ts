import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

/**
 * Supabase-client voor server components en route handlers, met de sessie van
 * de ingelogde gebruiker. RLS is van kracht.
 */
export async function createSupabaseServerClient() {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // In een server component kan er niet geschreven worden. De
            // middleware ververst de sessie; hier is negeren correct.
          }
        },
      },
    },
  );
}

/**
 * Client met de service role. Omzeilt RLS.
 *
 * Uitsluitend te gebruiken in server-side code die haar eigen autorisatie doet:
 * Stripe-webhooks, de ondertekenflow van de verhuurder (token-gebaseerd),
 * cron-taken en het toekennen van toegangsrechten. Nooit importeren in code
 * die met een clientverzoek kan meelopen zonder eigen controle.
 */
export function createSupabaseAdminClient() {
  const env = getEnv();

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Haalt de ingelogde gebruiker op, of null. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Haalt het profiel van de ingelogde gebruiker op, of null. */
export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return data;
}
