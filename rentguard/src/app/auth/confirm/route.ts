import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveLocale } from '@/i18n/config';
import { safeNextPath } from '@/lib/auth/redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Bevestigt een e-maillink op basis van `token_hash` (aanbevolen voor SSR).
 *
 * Gebruik in de Supabase-template "Reset Password":
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&locale=nl&next=/nl/reset-password`
 * Dit werkt ook wanneer de link in een andere browser geopend wordt dan
 * waarin de aanvraag gebeurde (de PKCE-code van `/auth/callback` niet).
 */
const ALLOWED_TYPES: EmailOtpType[] = ['recovery', 'signup', 'email'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const locale = resolveLocale(searchParams.get('locale'));
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next =
    type === 'recovery'
      ? `/${locale}/reset-password`
      : safeNextPath(searchParams.get('next'), locale);

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=UNKNOWN`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    const target =
      type === 'recovery'
        ? `/${locale}/forgot-password?error=SESSION_EXPIRED`
        : `/${locale}/login?error=UNKNOWN`;
    return NextResponse.redirect(`${origin}${target}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
