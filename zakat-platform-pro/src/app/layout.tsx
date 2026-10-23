import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import { siteConfig } from '@/config/site'

import '@/styles/globals.css'

/**
 * Inter, zelf gehost (SIL Open Font License, zie fonts/Inter-LICENSE.txt).
 *
 * Niet via `next/font/google`: dan haalt elke build het lettertype bij Google op,
 * en faalt de build zodra Google niet bereikbaar is (CI achter een proxy, een
 * hapering bij Google). Met het bestand in de repo is de build reproduceerbaar.
 */
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
    locale: 'nl_BE',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#101215' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" dir="ltr">
      <body className={`${inter.variable} min-h-dvh font-sans antialiased`}>{children}</body>
    </html>
  )
}
