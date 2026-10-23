import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { resolveLocale } from '@/i18n/config';

import './globals.css';

export const metadata: Metadata = {
  title: 'RentGuard Brussels',
  description:
    'Documenteer uw huurwoning, bewaak uw waarborgtermijn en controleer uw ' +
    'huurprijs. Voor huurders in het Brussels Hoofdstedelijk Gewest.',
  applicationName: 'RentGuard Brussels',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // De camera-flows staan vol met knoppen; zoomen moet mogelijk blijven.
  maximumScale: 5,
  themeColor: '#0f172a',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // De middleware zet deze header op basis van het taalsegment in de URL.
  const locale = resolveLocale((await headers()).get('x-locale'));

  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
