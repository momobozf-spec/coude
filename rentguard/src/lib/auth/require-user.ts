import { redirect } from 'next/navigation';

import type { Locale } from '@/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/types';

/**
 * Dwingt een ingelogde gebruiker af en geeft zijn profiel terug.
 *
 * Elke pagina onder `(app)` roept dit aan. De middleware ververst enkel de
 * sessie; autorisatie gebeurt hier, per pagina. Zo kan een vergeten controle in
 * de middleware nooit een pagina blootleggen.
 */
export async function requireProfile(locale: Locale): Promise<Profile> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    // De trigger op auth.users maakt het profiel aan. Ontbreekt het toch, dan
    // is er iets structureel mis; we sturen naar aanmelden in plaats van een
    // half werkende sessie te tonen.
    redirect(`/${locale}/login`);
  }

  return profile;
}

export async function requireAdmin(locale: Locale): Promise<Profile> {
  const profile = await requireProfile(locale);
  if (profile.role !== 'ADMIN') redirect(`/${locale}/dashboard`);
  return profile;
}
