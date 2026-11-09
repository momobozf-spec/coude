import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces, Noto_Naskh_Arabic } from 'next/font/google'
import { Toaster } from 'sonner'

import { ThemeProvider } from '@/components/layout/theme-provider'
import { TooltipProvider } from '@/components/ui/misc'
import { isRtlLocale, siteConfig } from '@/config/site'
import { getRequestLocale } from '@/i18n/server'
import { cn } from '@/lib/utils'

import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

/** Used sparingly — headlines only. Gives the brand a voice without decoration. */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK'],
})

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  // Not `--font-arabic`: that is the Tailwind theme token, and giving both the
  // same name made the token resolve to itself.
  variable: '--font-naskh',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
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
    url: siteConfig.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
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
