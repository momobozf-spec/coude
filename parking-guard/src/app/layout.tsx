import type { Metadata, Viewport } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Parking Guard Brussel',
  description:
    'Bewonerskaart aanvragen, verlengen of wijzigen in Brussel — documenten fotograferen, ' +
    'wij stellen je dossier samen.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Niet op maximumScale=1 zetten: dat breekt inzoomen voor wie slecht ziet.
  themeColor: '#1e40af',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
