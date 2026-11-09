import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { registerUser } from '@/modules/auth/register'
import { APP_NAME, GENERAL_DISCLAIMER } from '@/config/public'

export const metadata: Metadata = { title: 'Account aanmaken' }

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  async function register(formData: FormData) {
    'use server'

    const result = await registerUser({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      name: String(formData.get('name') ?? ''),
    })

    if (!result.ok) redirect(`/register?error=${encodeURIComponent(result.error)}`)
    redirect('/login')
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        {APP_NAME}
      </Link>

      <Card>
        <h1 className="text-xl font-semibold tracking-tight">Account aanmaken</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Daarna zetten we samen je aankooptraject op.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-[var(--color-rust-soft)]/30 px-3 py-2.5 text-sm text-[var(--color-rust-deep)]"
          >
            {error}
          </p>
        )}

        <form action={register} className="mt-6 space-y-4">
          <Field label="Naam" name="name" autoComplete="name" required />
          <Field label="E-mailadres" name="email" type="email" autoComplete="email" required />
          <Field
            label="Wachtwoord"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="Minstens 8 tekens."
          />
          <Button type="submit" size="lg" className="w-full">
            Account aanmaken
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">{GENERAL_DISCLAIMER}</p>
    </main>
  )
}

function Field({
  label,
  name,
  hint,
  ...props
}: {
  label: string
  name: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-describedby={hint ? `${name}-hint` : undefined}
        className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
        {...props}
      />
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-[var(--muted)]">
          {hint}
        </p>
      )}
    </div>
  )
}
