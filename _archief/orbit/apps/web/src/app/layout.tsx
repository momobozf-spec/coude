import type { Metadata, Viewport } from 'next';
import { buildTokenStylesheet } from '@orbit/ui';
import { Providers } from '@/components/providers';
import { NO_FLASH_SCRIPT } from '@/components/theme/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Orbit',
    template: '%s · Orbit',
  },
  description: 'Ideeën, taken en notities op één plek.',
  applicationName: 'Orbit',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0d111a' },
  ],
};

// De design tokens komen uit @orbit/ui en worden hier één keer als
// CSS-variabelen geïnjecteerd. Web en mobiel lezen daardoor dezelfde bron.
const tokenStylesheet = buildTokenStylesheet();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <style
          id="orbit-tokens"
          dangerouslySetInnerHTML={{ __html: tokenStylesheet }}
        />
        <script
          dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }}
        />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-base text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
