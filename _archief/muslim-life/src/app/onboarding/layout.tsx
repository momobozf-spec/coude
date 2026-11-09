import { SessionProvider } from 'next-auth/react'

import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'

/**
 * Onboarding has no app chrome — no sidebar, no nav. The only job here is to
 * finish setup, so every exit is deliberately removed.
 *
 * `SessionProvider` is needed because the wizard calls `update()` to refresh the
 * JWT once `onboardedAt` is set; without it middleware would bounce the user back.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="relative flex min-h-dvh flex-col">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-40"
          style={{
            background:
              'radial-gradient(50% 50% at 50% 0%, var(--primary-subtle) 0%, transparent 70%)',
          }}
          aria-hidden
        />

        <header className="relative flex items-center justify-between px-5 py-5">
          <Logo href="" />
          <ThemeToggle />
        </header>

        <main className="relative flex flex-1 items-start justify-center px-5 py-8 sm:items-center">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
