import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { LoginForm } from '@/modules/auth/login-form'

export const metadata: Metadata = { title: 'Inloggen' }

const NOTICES: Record<string, string> = {
  'sessie:verlopen': 'Je sessie is verlopen of ingetrokken. Log opnieuw in.',
  'sessie:ingetrokken': 'Je bent op al je toestellen afgemeld.',
  'wachtwoord:gewijzigd': 'Je wachtwoord is gewijzigd. Log in met je nieuwe wachtwoord.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const notice =
    NOTICES[`sessie:${query.sessie}`] ?? NOTICES[`wachtwoord:${query.wachtwoord}`] ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inloggen</CardTitle>
        <CardDescription>Welkom terug.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm" role="status">
            {notice}
          </p>
        ) : null}
        <LoginForm />
        <p className="text-sm text-muted">
          <Link href="/wachtwoord-vergeten" className="font-medium text-primary hover:underline">
            Wachtwoord vergeten?
          </Link>
        </p>
        <p className="text-sm text-muted">
          Nog geen account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Aanmelden
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
