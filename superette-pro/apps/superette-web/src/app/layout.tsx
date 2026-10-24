import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { NotificationsProvider } from '@/lib/notifications';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

/**
 * Elke pagina wordt per request gerenderd: alleen dan kan Next de CSP-nonce
 * uit `middleware.ts` op zijn eigen script-tags zetten. Statisch vooraf
 * gerenderde pagina's hebben geen nonce en worden door de strikte CSP
 * geblokkeerd (geen hydratie). De pagina's halen hun gegevens toch
 * client-side uit de API, dus er gaat geen caching verloren.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Superette', template: '%s · Superette' },
  description: 'Ontdek waar je boodschappen werkelijk het goedkoopst zijn. Vergelijk prijzen bij Belgische supermarkten.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Superette' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF7F0' },
    { media: '(prefers-color-scheme: dark)', color: '#17140F' },
  ],
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` en `data-theme` worden client-side bijgewerkt door de providers.
    <html lang="nl-BE" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <NotificationsProvider>{children}</NotificationsProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
