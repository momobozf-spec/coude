import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'FSBO Lead Radar Belgium',
  description:
    'Detecteert Belgische particuliere vastgoedadvertenties en stuurt ze als lead naar makelaars.',
  // Een intern paneel met persoonsgegevens hoort niet in een zoekmachine.
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
        {children}
      </body>
    </html>
  )
}
