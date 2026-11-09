import { NextResponse, type NextRequest } from 'next/server';

import { resolveLocale } from '@/i18n/config';
import { safeNextPath } from '@/lib/auth/redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Wisselt de code uit de bevestigings- of herstelmail in voor een sessie.
 * `next` gaat door een allowlist (`safeNextPath`) tegen open redirects.
 *
 * Bij een fout sturen we terug naar de aanmeldpagina met een foutcode; we tonen
 * nooit de ruwe foutmelding van de authenticatiedienst aan de gebruiker.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const locale = resolveLocale(searchParams.get('locale'));
  const next = safeNextPath(searchParams.get('next'), locale);
  const failure = next.endsWith('/reset-password')
    ? `${origin}/${locale}/forgot-password?error=SESSION_EXPIRED`
    : `${origin}/${locale}/login?error=UNKNOWN`;

  if (!code) return NextResponse.redirect(failure);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(failure);

  return NextResponse.redirect(`${origin}${next}`);
}
