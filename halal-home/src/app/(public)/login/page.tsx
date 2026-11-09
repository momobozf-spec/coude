import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { signIn } from '@/modules/auth'
import { APP_NAME } from '@/config/public'

export const metadata: Metadata = { title: 'Inloggen' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  /**
   * Server action. Het wachtwoord verlaat de server-boundary niet als
   * client-side state, en er is geen aparte API-route nodig die we apart tegen
   * CSRF moeten beschermen — Next doet dat voor server actions zelf.
   */
  async function authenticate(formData: FormData) {
    'use server'

    try {
      await signIn('credentials', {
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        redirectTo: '/dashboard',
      })
    } catch (error) {
      // `signIn` gooit een redirect-fout bij succes; die moet doorgegeven worden.
      if (error instanceof AuthError) {
        redirect('/login?error=credentials')
      }
      throw error
    }
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        {APP_NAME}
      </Link>

      <Card>
        <h1 className="text-xl font-semibold tracking-tight">Inloggen</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Verder waar je gebleven was.</p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-[var(--color-rust-soft)]/30 px-3 py-2.5 text-sm text-[var(--color-rust-deep)]"
          >
            E-mailadres of wachtwoord klopt niet.
          </p>
        )}

        <form action={authenticate} className="mt-6 space-y-4">
          <Field label="E-mailadres" name="email" type="email" autoComplete="email" required />
          <Field
            label="Wachtwoord"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
          <Button type="submit" size="lg" className="w-full">
            Inloggen
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Nog geen account?{' '}
        <Link href="/register" className="text-[var(--accent)] underline underline-offset-4">
          Maak er een aan
        </Link>
      </p>
    </main>
  )
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
        {...props}
      />
    </div>
  )
}
