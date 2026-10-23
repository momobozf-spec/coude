'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  changePasswordAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from '@/modules/auth/actions'
import { t } from '@/i18n'

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-3 text-sm text-danger"
    >
      <AlertCircle className="mt-px size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function SuccessBox({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-border bg-primary-subtle px-3.5 py-3 text-sm text-primary-subtle-foreground"
    >
      <CheckCircle2 className="mt-px size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

/** Request a reset link. The answer is identical whether or not the account exists. */
export function ForgotPasswordForm({ emailEnabled, supportEmail }: { emailEnabled: boolean; supportEmail: string | null }) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!emailEnabled) {
    return (
      <p className="rounded-lg bg-muted px-3.5 py-3 text-sm text-muted-foreground">
        {t('auth.resetUnavailable')}
        {supportEmail ? (
          <>
            {' '}
            <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
              {supportEmail}
            </a>
          </>
        ) : null}
      </p>
    )
  }

  if (sent) return <SuccessBox message={t('auth.resetSent')} />

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await requestPasswordResetAction(formData)
          if (!result.ok) setError(result.message)
          else setSent(true)
        })
      }}
    >
      {error ? <ErrorBox message={error} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        {t('auth.sendResetLink')}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          {t('common.signIn')}
        </Link>
      </p>
    </form>
  )
}

/** Choose a new password from a reset link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        const formData = new FormData(event.currentTarget)
        formData.set('token', token)
        startTransition(async () => {
          const result = await resetPasswordAction(formData)
          if (!result.ok) setError(result.message)
          else router.replace('/login?reset=1')
        })
      }}
    >
      {error ? <ErrorBox message={error} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="password">{t('auth.newPassword')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={72}
        />
        <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        {t('auth.savePassword')}
      </Button>
    </form>
  )
}

/** Change the password while signed in. Other sessions are signed out by the server. */
export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        const form = event.currentTarget
        const formData = new FormData(form)
        startTransition(async () => {
          const result = await changePasswordAction(formData)
          if (!result.ok) {
            setError(result.message)
            return
          }
          // Every session — including this one — predates the change and is
          // now revoked; sign in again with the new password.
          // A full page load (not a client transition): the route handler must
          // run to clear the session cookie.
          window.location.assign(new URL('/session-ended', window.location.origin).toString())
        })
      }}
    >
      {error ? <ErrorBox message={error} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{t('auth.currentPassword')}</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={72}
        />
        <p className="text-xs text-muted-foreground">{t('auth.changePasswordNote')}</p>
      </div>
      <Button type="submit" loading={pending}>
        {t('auth.savePassword')}
      </Button>
    </form>
  )
}
