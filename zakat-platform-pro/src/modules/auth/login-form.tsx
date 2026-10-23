'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

import { Button, FieldError, Input, Label } from '@/components/ui'
import { loginSchema } from '@/modules/auth/schemas'

export function LoginForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const form = new FormData(event.currentTarget)
    const parsed = loginSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Controleer je gegevens.')
      return
    }

    const result = await signIn('credentials', { ...parsed.data, redirect: false })

    // Never say which half was wrong — that turns the form into an account oracle.
    if (!result || result.error) {
      setError('Inloggen lukte niet. Controleer je gegevens of probeer het over een kwartier opnieuw.')
      return
    }

    startTransition(() => {
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
          autoComplete="current-password"
          required
        />
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" disabled={pending}>
        {pending ? 'Bezig…' : 'Inloggen'}
      </Button>
    </form>
  )
}
