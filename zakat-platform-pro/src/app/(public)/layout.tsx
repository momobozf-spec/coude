import Link from 'next/link'

import { ButtonLink } from '@/components/ui'
import { siteConfig } from '@/config/site'
import { getActor } from '@/server/auth/actor'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // The charity directory is public but reachable from the dashboard nav, so a
  // signed-in visitor gets a way back instead of a sign-up prompt.
  const actor = await getActor()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {siteConfig.name}
          </Link>

          <nav className="flex items-center gap-2">
            <ButtonLink
              href="/charities"
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Goede doelen
            </ButtonLink>

            {actor ? (
              <ButtonLink href="/dashboard" size="sm">
                Naar overzicht
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Inloggen
                </ButtonLink>
                <ButtonLink href="/register" size="sm">
                  Aanmelden
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted">
          <p className="font-medium text-foreground">{siteConfig.name}</p>
          <p className="max-w-2xl">{siteConfig.description}</p>
          <p className="mt-2 flex flex-wrap gap-4 text-xs">
            <span>© {new Date().getFullYear()} {siteConfig.name}</span>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/voorwaarden" className="hover:underline">Voorwaarden</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
