import type { ReactNode } from 'react'

import './globals.css'

/**
 * Root layout. The real <html>/<body> live in [locale]/layout.tsx, which knows
 * the language to declare. This wrapper exists only so Next has a root.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
