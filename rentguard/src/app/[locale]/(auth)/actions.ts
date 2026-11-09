'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

import { getEnv } from '@/lib/env';
import { resolveLocale } from '@/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Authenticatie-acties.
 *
 * Foutmeldingen komen terug als **code**, niet als tekst: de pagina vertaalt ze.
 * Zo blijft er geen Engelse Supabase-tekst in een Franstalige UI staan.
 */

export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'RATE_LIMITED'
  | 'UNKNOWN'
  | 'PASSWORDS_DO_NOT_MATCH'
  | 'SESSION_EXPIRED';

export interface AuthState {
  error: AuthErrorCode | null;
  /** Gezet na registratie: de gebruiker moet zijn e-mail bevestigen. */
  awaitingConfirmation?: boolean;
  /** Gezet na een herstelaanvraag (altijd, ook voor onbekende adressen). */
  resetRequested?: boolean;
  /** Veldfouten, per veldnaam. */
  fieldErrors?: Record<string, string[]>;
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  // Supabase hanteert standaard 6; wij zetten de lat hoger omdat er
  // foto's van iemands woning achter deze login zitten.
  password: z.string().min(10).max(200),
  language: z.enum(['nl', 'fr']),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function mapError(message: string, status?: number): AuthErrorCode {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'INVALID_CREDENTIALS';
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'EMAIL_TAKEN';
  }
  if (text.includes('password')) return 'WEAK_PASSWORD';
  if (status === 429 || text.includes('rate limit')) return 'RATE_LIMITED';
  return 'UNKNOWN';
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    language: locale,
  });

  if (!parsed.success) {
    return {
      error: 'INVALID_INPUT',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const origin =
    (await headers()).get('origin') ?? getEnv().APP_URL;

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?locale=${locale}`,
      data: {
        full_name: parsed.data.fullName,
        language: parsed.data.language,
      },
    },
  });

  if (error) return { error: mapError(error.message, error.status) };

  return { error: null, awaitingConfirmation: true };
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      error: 'INVALID_INPUT',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: mapError(error.message, error.status) };

  redirect(`/${locale}/dashboard`);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(formData.get('locale')?.toString());
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}

const forgotSchema = z.object({ email: z.string().trim().email() });

/**
 * Vraagt een herstellink aan.
 *
 * Antwoordt altijd hetzelfde, ook als het adres onbekend is: anders kan
 * iemand via dit formulier nagaan wie een account heeft. De link verwijst naar
 * `APP_URL` (nooit naar de Origin-header van het verzoek).
 */
export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const locale = resolveLocale(formData.get('locale')?.toString());
  const parsed = forgotSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return {
      error: 'INVALID_INPUT',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const next = encodeURIComponent(`/${locale}/reset-password`);
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getEnv().APP_URL}/auth/callback?locale=${locale}&next=${next}`,
  });

  if (error && (error.status === 429 || error.message.toLowerCase().includes('rate limit'))) {
    return { error: 'RATE_LIMITED' };
  }
  return { error: null, resetRequested: true };
}

const updatePasswordSchema = z.object({
  password: z.string().min(10).max(200),
  confirm: z.string(),
});

/** Bewaart het nieuwe wachtwoord binnen de herstelsessie. */
export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const locale = resolveLocale(formData.get('locale')?.toString());
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    return {
      error: 'INVALID_INPUT',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: 'PASSWORDS_DO_NOT_MATCH' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'SESSION_EXPIRED' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: mapError(error.message, error.status) };

  // Wie zijn wachtwoord herstelt, vermoedt vaak misbruik: sluit andere sessies.
  await supabase.auth.signOut({ scope: 'others' });

  redirect(`/${locale}/dashboard`);
}
