'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, Play, Plus, X } from 'lucide-react'

import { Badge, Button, Card, CardContent, FieldError, Input, Label, Select } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import type { ReminderView } from '@/server/modules/reminders/service'

/**
 * Reminder list and creation (§3, §8).
 *
 * The Hijri date is always labelled as an estimate and stays editable: a
 * computed lunar date is a calculation, not a ruling, and moon sighting differs
 * by region (§4).
 */

const RECURRENCE_LABELS: Record<string, string> = {
  ONE_TIME: 'Eenmalig',
  DAILY: 'Dagelijks',
  WEEKLY: 'Wekelijks',
  MONTHLY: 'Maandelijks',
  YEARLY: 'Jaarlijks (Gregoriaans)',
  HIJRI_YEARLY: 'Jaarlijks (Hijri)',
}

const STATUS_TONES: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actief',
  PAUSED: 'Gepauzeerd',
  COMPLETED: 'Afgerond',
  CANCELLED: 'Geannuleerd',
}

export interface ReminderPanelProps {
  reminders: readonly ReminderView[]
  timezone: string
  /** Preselects a Zakat reminder when arriving from a finalised calculation. */
  suggestion?: {
    title: string
    startAt: string
    hijriLabel: string | null
    zakatCalculationId: string
  } | null
}

export function ReminderPanel({ reminders, timezone, suggestion }: ReminderPanelProps) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(suggestion?.title ?? '')
  const [date, setDate] = useState(suggestion?.startAt.slice(0, 10) ?? '')
  const [localTime, setLocalTime] = useState('09:00')
  const [recurrence, setRecurrence] = useState(suggestion ? 'HIJRI_YEARLY' : 'ONE_TIME')
  const [adjustment, setAdjustment] = useState(0)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: suggestion ? 'ZAKAT_DUE' : 'CUSTOM',
          title: title.trim() || 'Herinnering',
          startAt: new Date(`${date}T12:00:00Z`).toISOString(),
          localTime,
          timezone,
          recurrence,
          calendarMethod: recurrence === 'HIJRI_YEARLY' ? 'ISLAMIC_UMALQURA' : 'GREGORIAN',
          manualAdjustmentDays: adjustment,
          zakatCalculationId: suggestion?.zakatCalculationId ?? null,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Opslaan lukte niet.')
      }

      setOpen(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Opslaan lukte niet.')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true)
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } catch {
      setError('Bijwerken lukte niet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {reminders.map((reminder) => (
        <Card key={reminder.id}>
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{reminder.title}</p>
                <p className="text-xs text-muted">
                  {RECURRENCE_LABELS[reminder.recurrence] ?? reminder.recurrence} ·{' '}
                  {reminder.timezone}
                </p>
              </div>
              <Badge tone={STATUS_TONES[reminder.status] ?? 'neutral'}>
                {STATUS_LABELS[reminder.status] ?? reminder.status}
              </Badge>
            </div>

            {reminder.nextTriggerAt ? (
              <div className="text-xs text-muted">
                <p>Volgende keer: {formatDate(reminder.nextTriggerAt)} om {reminder.localTime}</p>
                {reminder.hijriLabel ? (
                  // Always "geschat" — never presented as the definitive date (§4).
                  <p>Geschatte Hijri-datum: {reminder.hijriLabel}</p>
                ) : null}
              </div>
            ) : null}

            {reminder.manualAdjustmentDays !== 0 ? (
              <p className="text-xs text-muted">
                Handmatig gecorrigeerd met {reminder.manualAdjustmentDays > 0 ? '+' : ''}
                {reminder.manualAdjustmentDays} dag(en).
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {reminder.status === 'ACTIVE' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setStatus(reminder.id, 'PAUSED')}
                >
                  <Pause className="size-4" aria-hidden />
                  Pauzeren
                </Button>
              ) : reminder.status === 'PAUSED' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setStatus(reminder.id, 'ACTIVE')}
                >
                  <Play className="size-4" aria-hidden />
                  Hervatten
                </Button>
              ) : null}

              {reminder.status !== 'CANCELLED' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setStatus(reminder.id, 'CANCELLED')}
                >
                  <X className="size-4" aria-hidden />
                  Annuleren
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}

      {open ? (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={create} className="flex flex-col gap-3" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reminder-title">Titel</Label>
                <Input
                  id="reminder-title"
                  value={title}
                  placeholder="Zakat-datum"
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reminder-date">Datum</Label>
                  <Input
                    id="reminder-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reminder-time">Tijd (lokaal)</Label>
                  <Input
                    id="reminder-time"
                    type="time"
                    value={localTime}
                    onChange={(e) => setLocalTime(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted">
                    Blijft deze lokale tijd, ook na de zomer- of wintertijdwissel.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reminder-recurrence">Herhaling</Label>
                <Select
                  id="reminder-recurrence"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                >
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              {recurrence === 'HIJRI_YEARLY' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reminder-adjust">Correctie in dagen</Label>
                  <Select
                    id="reminder-adjust"
                    value={String(adjustment)}
                    onChange={(e) => setAdjustment(Number(e.target.value))}
                  >
                    <option value="-2">−2 dagen</option>
                    <option value="-1">−1 dag</option>
                    <option value="0">Geen correctie</option>
                    <option value="1">+1 dag</option>
                    <option value="2">+2 dagen</option>
                  </Select>
                  <p className="text-xs text-muted">
                    De Hijri-datum wordt rekenkundig geschat (Umm al-Qura). Maanwaarneming
                    verschilt per regio — corrigeer als die bij jou anders valt.
                  </p>
                </div>
              ) : null}

              <FieldError>{error}</FieldError>

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? 'Bezig…' : 'Herinnering opslaan'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Herinnering instellen
          </Button>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </div>
  )
}
