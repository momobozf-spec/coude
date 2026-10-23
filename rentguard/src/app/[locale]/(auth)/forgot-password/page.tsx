import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { ForgotPasswordForm } from '@/components/auth/password-forms';
import { SiteFooter } from '@/components/legal/site-footer';
import { Alert, Card } from '@/components/ui/surface';
import { requestPasswordResetAction } from '@/app/[locale]/(auth)/actions';

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { error } = await searchParams;
  const t = getMessages(locale);

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <Link href={`/${locale}/login`} className="text-sm text-slate-600 underline underline-offset-2">
        {t.common.back}
      </Link>

      <h1 className="mb-2 mt-4 text-2xl font-bold text-slate-900">{t.auth.forgotTitle}</h1>
      <p className="mb-6 text-sm text-slate-700">{t.auth.forgotIntro}</p>

      {error === 'SESSION_EXPIRED' ? (
        <Alert tone="warning" className="mb-4">
          <p>{t.auth.resetLinkInvalid}</p>
        </Alert>
      ) : null}

      <Card>
        <ForgotPasswordForm locale={locale} messages={t} action={requestPasswordResetAction} />
      </Card>
      <SiteFooter locale={locale} />
    </main>
  );
}
