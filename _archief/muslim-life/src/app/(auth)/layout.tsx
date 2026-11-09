import Link from 'next/link'

import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { t } from '@/i18n'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-50"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 0%, var(--primary-subtle) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <div className="bg-geometric pointer-events-none absolute inset-0 opacity-30" aria-hidden />

      <header className="relative flex items-center justify-between px-5 py-5">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="relative px-5 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground">
            {t('landing.footer.privacy')}
          </Link>
          <span className="mx-2">·</span>
          <Link href="/legal/terms" className="hover:text-foreground">
            {t('landing.footer.terms')}
          </Link>
        </p>
      </footer>
    </div>
  )
}
