'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

import { Button, FieldError, Input, Label } from '@/components/ui'

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.ok) return null
  const payload = await response.json().catch(() => null)
  const issues = payload?.error?.issues as Record<string, string[]> | undefined
  const firstIssue = issues ? Object.values(issues).flat()[0] : undefined
  return firstIssue ?? payload?.error?.message ?? 'Er ging iets mis. Probeer het opnieuw.'
}

export function ChangePasswordForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const problem = await send('/api/account/password', 'POST', {
      currentPassword: form.get('currentPassword'),
      newPassword: form.get('newPassword'),
      confirmPassword: form.get('confirmPassword'),
    })

    if (problem) {
      setError(problem)
      setBusy(false)
      return
    }

    // Alle sessies zijn ingetrokken, ook deze: opnieuw inloggen met het nieuwe wachtwoord.
    await signOut({ callbackUrl: '/login?wachtwoord=gewijzigd' })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">Huidig wachtwoord</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
        <p className="text-xs text-muted">Minstens 10 tekens. Een zin werkt prima.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Nieuw wachtwoord herhalen</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>
      <FieldError>{error}</FieldError>
      <div>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Bezig…' : 'Wachtwoord wijzigen'}
        </Button>
      </div>
    </form>
  )
}

export function RevokeSessionsButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function revoke() {
    setBusy(true)
    setError(null)
    const problem = await send('/api/account/sessions', 'DELETE')
    if (problem) {
      setError(problem)
      setBusy(false)
      return
    }
    await signOut({ callbackUrl: '/login?sessie=ingetrokken' })
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={revoke}>
          {busy ? 'Bezig…' : 'Overal afmelden'}
        </Button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}

export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <div>
        <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
          Account verwijderen…
        </Button>
      </div>
    )
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const problem = await send('/api/account', 'DELETE', {
      email: form.get('email'),
      password: hasPassword ? form.get('password') : undefined,
    })

    if (problem) {
      setError(problem)
      setBusy(false)
      return
    }
    await signOut({ callbackUrl: '/?account=verwijderd' })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-danger/40 p-4" noValidate>
      <p className="text-sm">
        Dit wist je account, je berekeningen, donaties, herinneringen en geüploade bestanden
        definitief. Dat kan niet ongedaan worden. Download eerst je gegevens als je ze wilt bewaren.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delete-email">Typ je e-mailadres ter bevestiging</Label>
        <Input id="delete-email" name="email" type="email" autoComplete="off" required />
      </div>
      {hasPassword ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-password">Wachtwoord</Label>
          <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
        </div>
      ) : null}
      <FieldError>{error}</FieldError>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={busy}>
          {busy ? 'Bezig…' : 'Definitief verwijderen'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          Annuleren
        </Button>
      </div>
    </form>
  )
}

export function ResetRequestForm() {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const problem = await send('/api/password-reset/request', 'POST', { email: form.get('email') })
    setBusy(false)
    if (problem) setError(problem)
    else setSent(true)
  }

  if (sent) {
    return (
      <p className="text-sm" role="status">
        Als er een account bestaat met dit e-mailadres, is er een mail onderweg met een link om
        een nieuw wachtwoord te kiezen. De link is één uur geldig.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mailadres</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={busy}>
        {busy ? 'Bezig…' : 'Herstellink versturen'}
      </Button>
    </form>
  )
}

export function ResetConfirmForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const problem = await send('/api/password-reset/confirm', 'POST', {
      token,
      password: form.get('password'),
      confirmPassword: form.get('confirmPassword'),
    })
    setBusy(false)
    if (problem) setError(problem)
    else setDone(true)
  }

  if (done) {
    return (
      <p className="text-sm" role="status">
        Je wachtwoord is gewijzigd. Je bent overal afgemeld.{' '}
        <a href="/login" className="font-medium text-primary hover:underline">
          Log in met je nieuwe wachtwoord
        </a>
        .
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nieuw wachtwoord</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <p className="text-xs text-muted">Minstens 10 tekens.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Nieuw wachtwoord herhalen</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={busy}>
        {busy ? 'Bezig…' : 'Wachtwoord opslaan'}
      </Button>
    </form>
  )
}

export function EmailRemindersToggle({ initial, available }: { initial: boolean; available: boolean }) {
  const [enabled, setEnabled] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(next: boolean) {
    setBusy(true)
    setError(null)
    const problem = await send('/api/account/notifications', 'PATCH', { emailReminders: next })
    setBusy(false)
    if (problem) setError(problem)
    else setEnabled(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={enabled}
          disabled={busy}
          onChange={(event) => toggle(event.target.checked)}
        />
        Herinneringen ook per e-mail ontvangen
      </label>
      {available ? null : (
        <p className="text-xs text-muted">E-mail is op deze installatie nog niet ingesteld; je krijgt herinneringen alleen in de app.</p>
      )}
      <FieldError>{error}</FieldError>
    </div>
  )
}
