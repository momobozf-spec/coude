import type { Metadata, Viewport } from 'next'
import { APP_NAME, APP_TAGLINE } from '@/config/public'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — van zoeken tot de sleutel`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  manifest: '/manifest.webmanifest',
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  // Documenten en trajecten horen niet in een zoekindex.
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1c20' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Geen maximumScale: inzoomen blokkeren maakt de app onbruikbaar voor wie
  // slecht ziet, en dit platform toont contracten en attesten.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:shadow"
        >
          Ga naar inhoud
        </a>
        {children}
      </body>
    </html>
  )
}
