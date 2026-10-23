'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * The three data controls.
 *
 * Each destructive one requires the member to type a word. That is not
 * ceremony: "clear my activity" and "delete my account" sit next to each other,
 * they are both irreversible, and a confirmation dialog with a red button is
 * something people click through on autopilot. Typing forces reading.
 */

interface ExportProps {
  allowed: boolean
  retryAfterHours: number
  lastExportAt: string | null
}

export function ExportControl({ allowed, retryAfterHours, lastExportAt }: ExportProps) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const response = await fetch('/api/privacy/export', { method: 'POST' })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message ?? 'The export could not be prepared.')
      }

      // Streamed straight to a download; nothing is stored on a server and no
      // shareable link is ever created.
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `muslim-life-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      toast.success('Your data has been downloaded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Download className="size-4 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Download your data</p>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            A single JSON file with everything you&rsquo;ve created: prayers, habits, tasks,
            planner, reflections, saved places and your assistant conversations. It contains no
            passwords, no session tokens, no security records and nobody else&rsquo;s data.
          </p>
          {lastExportAt ? (
            <p className="text-xs text-muted-foreground">
              Last export: {new Date(lastExportAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={download} disabled={busy || !allowed}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Download my data
        </Button>
        {!allowed ? (
          <p className="text-xs text-muted-foreground">
            You can request another export in {retryAfterHours} hours.
          </p>
        ) : null}
      </div>
    </Card>
  )
}

export function ClearActivityControl() {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const response = await fetch('/api/privacy/activity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      })

      const body = (await response.json().catch(() => null)) as
        | { total?: number; error?: { message?: string } }
        | null

      if (!response.ok) throw new Error(body?.error?.message ?? 'That did not work.')

      toast.success(`Cleared ${body?.total ?? 0} records.`)
      setConfirmation('')
      // A hard reload rather than a router refresh: half the app's cached
      // server components now describe data that no longer exists.
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Trash2 className="size-4 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Clear your activity</p>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Removes what you&rsquo;ve tracked while keeping your account: prayer logs, habit
            history, tasks, planner blocks and reflections. Your settings and subscription stay.
            This cannot be undone.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="clear-confirmation" className="text-xs">
            Type CLEAR to confirm
          </Label>
          <Input
            id="clear-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="w-40"
          />
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={submit}
          disabled={busy || confirmation.trim().toUpperCase() !== 'CLEAR'}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Clear my activity
        </Button>
      </div>
    </Card>
  )
}

interface DeleteAccountProps {
  status: string
  scheduledFor: string | null
  blockedByBilling: boolean
  graceDays: number
}

export function DeleteAccountControl({
  status,
  scheduledFor,
  blockedByBilling,
  graceDays,
}: DeleteAccountProps) {
  const [confirmation, setConfirmation] = useState('')
  const [pending, startTransition] = useTransition()

  const requested = status === 'REQUESTED'

  async function call(method: 'POST' | 'DELETE') {
    const response = await fetch('/api/privacy/account', {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ confirmation }) : undefined,
    })

    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null

    if (!response.ok) throw new Error(body?.error?.message ?? 'That did not work.')
  }

  function submit(method: 'POST' | 'DELETE') {
    startTransition(async () => {
      try {
        await call(method)
        toast.success(
          method === 'POST'
            ? 'Your deletion request has been recorded.'
            : 'Your account will not be deleted.',
        )
        window.location.reload()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Something went wrong.')
      }
    })
  }

  if (requested) {
    return (
      <Card className="space-y-4 border-warning/40 bg-warning-subtle p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/20">
            <AlertTriangle className="size-4 text-warning" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">Deletion requested</p>
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              Your account is scheduled for deletion
              {scheduledFor ? ` on ${new Date(scheduledFor).toLocaleDateString()}` : ''}. Nothing
              has been removed yet, and signing in and cancelling stops it.
            </p>
          </div>
        </div>

        <Button size="sm" variant="secondary" onClick={() => submit('DELETE')} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Keep my account
        </Button>
      </Card>
    )
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Trash2 className="size-4 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Delete your account</p>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Removes your account and personal data. You&rsquo;ll be signed out everywhere and have{' '}
            {graceDays} days to change your mind before anything is removed. Invoices and a minimal
            security log are kept because the law requires it.
          </p>
        </div>
      </div>

      {blockedByBilling ? (
        <p className="rounded-lg bg-warning-subtle p-3 text-xs leading-relaxed text-foreground">
          You have an active paid subscription. Cancel it first — we won&rsquo;t delete an account
          while a payment provider can still charge it.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirmation" className="text-xs">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className="w-40"
            />
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={() => submit('POST')}
            disabled={pending || confirmation.trim().toUpperCase() !== 'DELETE'}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete my account
          </Button>
        </div>
      )}
    </Card>
  )
}
