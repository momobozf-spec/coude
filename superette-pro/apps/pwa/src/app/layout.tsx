import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jamal & Jamila',
  description: 'Uw sleutel tot de boetiek',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Jamal & Jamila' },
};

export const viewport: Viewport = {
  themeColor: '#0B3D2E',
  // `viewport-fit=cover` + de safe-area-insets in de shell: de navigatiebalk mag
  // niet onder de home-indicator van een iPhone verdwijnen.
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `data-palette` wordt door ThemeProvider gezet; deze waarde is de
    // server-rendered standaard en voorkomt een kleurflits bij het laden.
    <html lang="nl" data-palette="emerald" suppressHydrationWarning>
      <body className="arabesque">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
