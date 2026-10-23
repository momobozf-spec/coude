import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { ResetPasswordForm } from '@/components/auth/password-forms';
import { SiteFooter } from '@/components/legal/site-footer';
import { Alert, Card } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/supabase/server';
import { updatePasswordAction } from '@/app/[locale]/(auth)/actions';

/**
 * Nieuw wachtwoord kiezen. Bereikbaar via de herstellink, die een (herstel)
 * sessie opent in `/auth/callback` of `/auth/confirm`.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);
  const user = await getCurrentUser();

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-6 mt-4 text-2xl font-bold text-slate-900">{t.auth.resetTitle}</h1>

      {user ? (
        <Card>
          <ResetPasswordForm locale={locale} messages={t} action={updatePasswordAction} />
        </Card>
      ) : (
        <Alert tone="warning">
          <p>{t.auth.resetLinkInvalid}</p>
          <p>
            <Link href={`/${locale}/forgot-password`} className="underline underline-offset-2">
              {t.auth.forgotPassword}
            </Link>
          </p>
        </Alert>
      )}
      <SiteFooter locale={locale} />
    </main>
  );
}
