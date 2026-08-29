import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { signOutAction } from '@/app/[locale]/(auth)/actions';
import { Button } from '@/components/ui/button';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireProfile(locale);
  const t = getMessages(locale);

  const nav = [
    { href: `/${locale}/dashboard`, label: t.nav.dashboard },
    { href: `/${locale}/properties`, label: t.nav.properties },
  ];

  const otherLocale = locale === 'nl' ? 'fr' : 'nl';

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
          <Link href={`/${locale}/dashboard`} className="font-semibold">
            {t.common.appName}
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={`/${otherLocale}/dashboard`}
              className="text-sm text-slate-600 underline underline-offset-2"
              hrefLang={otherLocale}
            >
              {otherLocale === 'fr' ? 'FR' : 'NL'}
            </Link>

            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="ghost" size="sm">
                {t.auth.signOut}
              </Button>
            </form>
          </div>
        </div>

        <nav className="mx-auto max-w-4xl px-5">
          <ul className="flex gap-1 overflow-x-auto pb-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">
        <span className="sr-only">{profile.email}</span>
        {children}
      </main>
    </div>
  );
}
