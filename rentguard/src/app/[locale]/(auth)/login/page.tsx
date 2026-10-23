import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { AuthForm } from '@/components/auth/auth-form';
import { Card } from '@/components/ui/surface';
import { SiteFooter } from '@/components/legal/site-footer';
import { loginAction } from '@/app/[locale]/(auth)/actions';

export default async function LoginPage({
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

      <h1 className="mb-6 mt-4 text-2xl font-bold text-slate-900">
        {t.auth.signIn}
      </h1>

      <Card>
        <AuthForm
          mode="login"
          locale={locale}
          messages={t}
          action={loginAction}
        />
      </Card>

      <p className="mt-4 text-sm">
        <Link
          href={`/${locale}/forgot-password`}
          className="text-slate-700 underline underline-offset-2"
        >
          {t.auth.forgotPassword}
        </Link>
      </p>

      <p className="mt-5 text-sm text-slate-700">
        {t.auth.noAccountYet}{' '}
        <Link
          href={`/${locale}/register`}
          className="font-medium underline underline-offset-2"
        >
          {t.auth.signUp}
        </Link>
      </p>
      <SiteFooter locale={locale} />
    </main>
  );
}
