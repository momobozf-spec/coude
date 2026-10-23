'use client'

import { useState, useTransition } from 'react'
import { Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { updateNotificationPreferencesAction } from '@/modules/settings/actions'
import { cn } from '@/lib/utils'

/**
 * Notification preferences.
 *
 * Everything optional starts off. A channel the product cannot actually deliver
 * on is shown as unavailable rather than hidden — a member who turns on "email"
 * and receives nothing would rightly conclude the app is broken, and a toggle
 * that silently does nothing is worse than an absent one.
 */

type Channel = 'IN_APP' | 'PUSH' | 'EMAIL'

export interface NotificationTypeRow {
  type: string
  label: string
  description: string
  transactional: boolean
  allowedChannels: Channel[]
  selectedChannels: Channel[]
}

interface Props {
  rows: NotificationTypeRow[]
  allMuted: boolean
  /** Channels the configured provider can actually deliver on today. */
  deliverableChannels: Channel[]
  labels: Record<Channel, string>
}

export function NotificationSettings({ rows, allMuted, deliverableChannels, labels }: Props) {
  const [state, setState] = useState(() => ({
    allMuted,
    types: Object.fromEntries(rows.map((row) => [row.type, row.selectedChannels])) as Record<
      string,
      Channel[]
    >,
  }))
  const [pending, startTransition] = useTransition()
  const [dirty, setDirty] = useState(false)

  function toggle(type: string, channel: Channel) {
    setDirty(true)
    setState((previous) => {
      const current = previous.types[type] ?? []
      return {
        ...previous,
        types: {
          ...previous.types,
          [type]: current.includes(channel)
            ? current.filter((value) => value !== channel)
            : [...current, channel],
        },
      }
    })
  }

  function save() {
    startTransition(async () => {
      const result = await updateNotificationPreferencesAction({
        allMuted: state.allMuted,
        types: Object.fromEntries(
          Object.entries(state.types).map(([type, channels]) => [type, { channels }]),
        ),
      })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      setDirty(false)
      toast.success('Saved.')
    })
  }

  const missingChannels = (['PUSH', 'EMAIL'] as Channel[]).filter(
    (channel) => !deliverableChannels.includes(channel),
  )

  return (
    <div className="space-y-4">
      {missingChannels.length > 0 ? (
        <p
          className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground"
          role="note"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Push and email delivery are not connected yet, so only in-app notifications actually
            arrive. Choices you make here are saved and will apply once they are.
          </span>
        </p>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium">Pause all optional notifications</p>
          <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Messages about your payments, your data and your account still come through.
          </p>
        </div>
        <Switch
          checked={state.allMuted}
          label="Pause all optional notifications"
          onChange={(checked) => {
            setDirty(true)
            setState((previous) => ({ ...previous, allMuted: checked }))
          }}
        />
      </Card>

      <Card className="divide-y divide-border p-0">
        {rows.map((row) => (
          <div key={row.type} className="space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{row.label}</p>
                  {row.transactional ? (
                    <Badge variant="outline" size="sm">
                      Always sent
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  {row.transactional
                    ? 'Always sent — this concerns your account or your payment.'
                    : row.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {row.allowedChannels.map((channel) => {
                const selected = (state.types[row.type] ?? []).includes(channel)
                const deliverable = deliverableChannels.includes(channel)

                return (
                  <button
                    key={channel}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(row.type, channel)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition',
                      selected
                        ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                        : 'border-border text-muted-foreground hover:border-border-strong hover:bg-muted',
                    )}
                  >
                    {labels[channel]}
                    {!deliverable ? (
                      <span className="ms-1.5 text-[0.6875rem] opacity-70">(not connected)</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </Card>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending || !dirty}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  )
}

/** A plain accessible switch — the design system has no toggle primitive yet. */
function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition',
        checked ? 'bg-primary' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          // `start-*` rather than `left-*`, so the knob moves the correct way in
          // Arabic without a second rule.
          'absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-[inset-inline-start]',
          checked ? 'start-[1.375rem]' : 'start-0.5',
        )}
      />
    </button>
  )
}
