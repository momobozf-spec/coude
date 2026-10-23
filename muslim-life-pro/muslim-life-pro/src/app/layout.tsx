import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from 'sonner'

import { ThemeProvider } from '@/components/layout/theme-provider'
import { TooltipProvider } from '@/components/ui/misc'
import { isRtlLocale, siteConfig } from '@/config/site'
import { appUrl } from '@/config/app-url'
import { getRequestLocale } from '@/i18n/server'
import { cn } from '@/lib/utils'

import '@/styles/globals.css'

/*
 * Fonts are self-hosted from src/app/fonts (variable WOFF2, SIL Open Font
 * License 1.1, taken from Fontsource). The build no longer depends on reaching
 * Google Fonts, and members' browsers never contact a third party for them.
 */
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
})

/** Used sparingly — headlines only. Gives the brand a voice without decoration. */
const fraunces = localFont({
  // The "full" file carries the SOFT and WONK axes the headlines use.
  src: './fonts/fraunces-latin-full-normal.woff2',
  weight: '100 900',
  variable: '--font-fraunces',
  display: 'swap',
})

const notoNaskh = localFont({
  src: './fonts/noto-naskh-arabic-arabic-wght-normal.woff2',
  weight: '400 700',
  // Not `--font-arabic`: that is the Tailwind theme token, and giving both the
  // same name made the token resolve to itself.
  variable: '--font-naskh',
  display: 'swap',
})

/** Built per request, so the canonical base is the live `APP_URL`, not a build-time value. */
export async function generateMetadata(): Promise<Metadata> {
  const base = appUrl()
  return {
  metadataBase: new URL(base),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    'muslim app',
    'prayer times',
    'islamic planner',
    'habit tracker',
    'halal deals',
    'muslim lifestyle',
  ],
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: base,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcf9' },
    { media: '(prefers-color-scheme: dark)', color: '#111318' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale()
  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          fraunces.variable,
          notoNaskh.variable,
          // The Arabic face is applied by the `[lang='ar']` rule in globals.css,
          // so it follows the document language rather than being duplicated here.
          'min-h-dvh bg-background font-sans antialiased',
        )}
      >
        <ThemeProvider>
          <TooltipProvider delayDuration={250}>
            {children}
            <Toaster
              position="bottom-center"
              toastOptions={{
                classNames: {
                  toast:
                    'bg-surface border border-border text-foreground shadow-lg rounded-xl text-sm',
                  description: 'text-muted-foreground',
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
