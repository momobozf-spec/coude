import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo/wdth.css';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';
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
  applicationName: 'Superette',
  description: 'Ontdek waar je boodschappen werkelijk het goedkoopst zijn. Vergelijk prijzen bij Belgische supermarkten.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Als app op het beginscherm van een iPhone: volledig scherm, de groene balk loopt onder de statusbalk door.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Superette' },
  formatDetection: { telephone: false },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  // Kleur van de browser-/statusbalk = de app-balk.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0E5A43' },
    { media: '(prefers-color-scheme: dark)', color: '#101A16' },
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
              <ServiceWorkerRegistrar />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
