import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { AuthForm } from '@/components/auth/auth-form';
import { Card } from '@/components/ui/surface';
import { SiteFooter } from '@/components/legal/site-footer';
import { DisclaimerNotice } from '@/components/legal/legal-notices';
import { registerAction } from '@/app/[locale]/(auth)/actions';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getMessages(locale);

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <Link
        href={`/${locale}`}
        className="text-sm text-slate-600 underline underline-offset-2"
      >
        {t.common.back}
      </Link>

      <h1 className="mb-2 mt-4 text-2xl font-bold text-slate-900">
        {t.auth.signUp}
      </h1>
      <p className="mb-6 text-sm text-slate-700">{t.billing.freeCheckIn}</p>

      <Card>
        <AuthForm
          mode="register"
          locale={locale}
          messages={t}
          action={registerAction}
        />
      </Card>

      <p className="mt-4 text-xs text-slate-600">
        {t.auth.termsNotice}{' '}
        <Link href={`/${locale}/legal/terms`} className="underline underline-offset-2">
          {locale === 'nl' ? 'Voorwaarden' : 'Conditions'}
        </Link>
        {' · '}
        <Link href={`/${locale}/legal/privacy`} className="underline underline-offset-2">
          {locale === 'nl' ? 'Privacy' : 'Confidentialité'}
        </Link>
      </p>

      <p className="mt-5 text-sm text-slate-700">
        {t.auth.alreadyHaveAccount}{' '}
        <Link
          href={`/${locale}/login`}
          className="font-medium underline underline-offset-2"
        >
          {t.auth.signIn}
        </Link>
      </p>

      <div className="mt-6">
        <DisclaimerNotice locale={locale} />
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
