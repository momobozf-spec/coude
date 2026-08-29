import { NextResponse, type NextRequest } from 'next/server';

import { resolveLocale } from '@/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Wisselt de code uit de bevestigingsmail in voor een sessie.
 *
 * Bij een fout sturen we terug naar de aanmeldpagina met een foutcode; we tonen
 * nooit de ruwe foutmelding van de authenticatiedienst aan de gebruiker.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const locale = resolveLocale(searchParams.get('locale'));

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=UNKNOWN`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=UNKNOWN`);
  }

  return NextResponse.redirect(`${origin}/${locale}/dashboard`);
}
