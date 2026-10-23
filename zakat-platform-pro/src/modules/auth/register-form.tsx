'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

import { Button, FieldError, Input, Label } from '@/components/ui'
import { registerSchema } from '@/modules/auth/schemas'

export function RegisterForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const form = new FormData(event.currentTarget)
    const parsed = registerSchema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
      specialDataConsent: form.get('specialDataConsent') === 'on',
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Controleer je gegevens.')
      return
    }

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.error?.message ?? 'Aanmelden lukte niet. Probeer het opnieuw.')
      return
    }

    // Sign in straight away so the user lands on onboarding, not the login form.
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })

    startTransition(() => {
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Naam</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mailadres</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Wachtwoord</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
        <p className="text-xs text-muted">Minstens 10 tekens.</p>
      </div>

      <label htmlFor="specialDataConsent" className="flex cursor-pointer items-start gap-2 text-xs text-muted">
        <input
          id="specialDataConsent"
          name="specialDataConsent"
          type="checkbox"
          required
          className="mt-0.5 size-4 shrink-0 cursor-pointer"
        />
        <span>
          Ik geef uitdrukkelijk toestemming dat Barakah mijn Zakat-, Sadaqah- en donatiegegevens bewaart. Die
          kunnen mijn religieuze overtuiging tonen. Ik kan deze toestemming altijd intrekken door mijn
          account te verwijderen.
        </span>
      </label>

      <FieldError>{error}</FieldError>

      <p className="text-xs text-muted">
        Door je aan te melden aanvaard je de{' '}
        <a href="/voorwaarden" target="_blank" className="underline">gebruiksvoorwaarden</a> en de{' '}
        <a href="/privacy" target="_blank" className="underline">privacyverklaring</a>.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? 'Bezig…' : 'Account aanmaken'}
      </Button>
    </form>
  )
}
