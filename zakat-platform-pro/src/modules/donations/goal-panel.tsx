'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button, Card, CardContent, FieldError, Input, Label, Select } from '@/components/ui'
import { formatMoney } from '@/lib/money'
import { donationApi, DonationApiError } from '@/modules/donations/api'
import { SADAQAH_PERIOD_LABELS } from '@/modules/donations/labels'
import type { SadaqahGoalProgress } from '@/server/modules/donations/sadaqah-service'

/**
 * Sadaqah goals (§10–§12).
 *
 * Progress is shown as a plain fraction and a bar. Deliberately absent: streaks,
 * failure states, comparisons with other users, and any nudge implying a moral
 * shortfall. A goal that is not met simply reads as a smaller number.
 */
export function GoalPanel({
  goals,
  currencies,
  defaultCurrency,
}: {
  goals: readonly SadaqahGoalProgress[]
  currencies: readonly string[]
  defaultCurrency: string
}) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [period, setPeriod] = useState('MONTHLY')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    try {
      await donationApi.createGoal({
        label: label.trim() || null,
        amount,
        currency,
        period,
        startDate: new Date().toISOString(),
      })
      setOpen(false)
      setAmount('')
      setLabel('')
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof DonationApiError ? caught.message : 'Opslaan lukte niet.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function archive(id: string) {
    setBusy(true)
    try {
      await donationApi.archiveGoal(id)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof DonationApiError ? caught.message : 'Archiveren lukte niet.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {goals.map((goal) => (
        <Card key={goal.id}>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium">{goal.label ?? 'Mijn Sadaqah-doel'}</p>
                <p className="text-xs text-muted">
                  {formatMoney(goal.targetMinor, goal.currency)}{' '}
                  {SADAQAH_PERIOD_LABELS[goal.period] ?? ''}
                </p>
              </div>
              <p className="tabular text-sm font-semibold">
                {formatMoney(goal.achievedMinor, goal.currency)} van{' '}
                {formatMoney(goal.targetMinor, goal.currency)}
              </p>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-valuenow={goal.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Voortgang van ${goal.label ?? 'je Sadaqah-doel'}`}
            >
              <div
                className={goal.reached ? 'h-full bg-success' : 'h-full bg-primary'}
                style={{ width: `${goal.percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">{goal.percentage}%</span>
              {goal.editable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => archive(goal.id)}
                >
                  Archiveren
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
                <Label htmlFor="goal-label">Naam (optioneel)</Label>
                <Input
                  id="goal-label"
                  value={label}
                  placeholder="Maandelijkse Sadaqah"
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-amount">Bedrag</Label>
                  <Input
                    id="goal-amount"
                    inputMode="decimal"
                    value={amount}
                    placeholder="50.00"
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-currency">Valuta</Label>
                  <Select
                    id="goal-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {currencies.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-period">Periode</Label>
                <Select
                  id="goal-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="DAILY">Per dag</option>
                  <option value="WEEKLY">Per week</option>
                  <option value="MONTHLY">Per maand</option>
                  <option value="YEARLY">Per jaar</option>
                </Select>
              </div>

              <FieldError>{error}</FieldError>

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? 'Bezig…' : 'Doel opslaan'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
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
            Sadaqah-doel instellen
          </Button>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </div>
  )
}
