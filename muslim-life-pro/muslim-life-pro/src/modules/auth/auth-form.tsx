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
import { safeCallbackPath } from '@/lib/safe-redirect'

interface AuthFormProps {
  mode: 'login' | 'register'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isRegister = mode === 'register'
  // Only same-site paths: a crafted link must not bounce a member off-site.
  const callbackPath = safeCallbackPath(searchParams.get('callbackUrl'))

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
      router.replace(isRegister ? '/onboarding' : callbackPath)
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
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          {!isRegister ? (
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          ) : null}
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={isRegister ? 10 : undefined}
          maxLength={72}
          aria-describedby={isRegister ? 'password-hint' : undefined}
        />
        {isRegister ? (
          <p id="password-hint" className="text-xs text-muted-foreground">
            {t('auth.passwordHint')}
          </p>
        ) : null}
      </div>

      {isRegister ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <label htmlFor="consent" className="text-xs leading-relaxed text-muted-foreground">
            {t('auth.consent')}{' '}
            <Link href="/legal/terms" target="_blank" className="text-primary hover:underline">
              {t('landing.footer.terms')}
            </Link>
            {' · '}
            <Link href="/legal/privacy" target="_blank" className="text-primary hover:underline">
              {t('landing.footer.privacy')}
            </Link>
          </label>
        </div>
      ) : null}

      <Button type="submit" className="w-full" size="lg" loading={pending}>
        {isRegister ? t('common.signUp') : t('common.signIn')}
      </Button>

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
