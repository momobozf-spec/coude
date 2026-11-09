'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginAction, registerAction } from '@/modules/auth/actions'
import { t } from '@/i18n'

interface AuthFormProps {
  mode: 'login' | 'register'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isRegister = mode === 'register'
  const callbackUrl = searchParams.get('callbackUrl')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = isRegister ? await registerAction(formData) : await loginAction(formData)

      if (!result.ok) {
        setError(result.message)
        return
      }

      // New accounts always land in onboarding; returning users go where they meant
      // to go. `refresh()` re-runs middleware with the new session cookie.
      router.replace(isRegister ? '/onboarding' : (callbackUrl ?? '/app'))
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {isRegister ? (
        <div className="space-y-1.5">
          <Label htmlFor="name">{t('auth.name')}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            placeholder="Mohamed"
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t('auth.emailPlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={isRegister ? 10 : undefined}
          aria-describedby={isRegister ? 'password-hint' : undefined}
        />
        {isRegister ? (
          <p id="password-hint" className="text-xs text-muted-foreground">
            {t('auth.passwordHint')}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" size="lg" loading={pending}>
        {isRegister ? t('common.signUp') : t('common.signIn')}
      </Button>

      {isRegister ? (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {t('auth.terms')}
        </p>
      ) : null}

      <p className="pt-2 text-center text-sm text-muted-foreground">
        {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-medium text-primary hover:underline"
        >
          {isRegister ? t('common.signIn') : t('common.signUp')}
        </Link>
      </p>
    </form>
  )
}
