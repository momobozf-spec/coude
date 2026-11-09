'use client'

import { useActionState } from 'react'

import { saveSource, type SourceActionState } from './actions'

import { Button, inputClass } from '@/components/ui'

const EMPTY: SourceActionState = {}

export function SourceSettingsForm({
  source,
}: {
  source: {
    key: string
    enabled: boolean
    pollIntervalSeconds: number
    rateLimitPerMinute: number
    timeoutMs: number
    maxRetries: number
  }
}) {
  const [state, action, pending] = useActionState(saveSource, EMPTY)

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="key" value={source.key} />

      <label className="flex items-center gap-2 pb-1.5 text-xs">
        <input type="checkbox" name="enabled" defaultChecked={source.enabled} />
        <span>Aan</span>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-[var(--color-ink-soft)]">interval (s)</span>
        <input
          name="pollIntervalSeconds"
          type="number"
          min={30}
          max={86400}
          defaultValue={source.pollIntervalSeconds}
          className={`${inputClass} w-24`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-[var(--color-ink-soft)]">req/min</span>
        <input
          name="rateLimitPerMinute"
          type="number"
          min={1}
          max={600}
          defaultValue={source.rateLimitPerMinute}
          className={`${inputClass} w-20`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-[var(--color-ink-soft)]">timeout (ms)</span>
        <input
          name="timeoutMs"
          type="number"
          min={1000}
          max={120000}
          step={500}
          defaultValue={source.timeoutMs}
          className={`${inputClass} w-24`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-[var(--color-ink-soft)]">retries</span>
        <input
          name="maxRetries"
          type="number"
          min={0}
          max={10}
          defaultValue={source.maxRetries}
          className={`${inputClass} w-16`}
        />
      </label>

      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? 'Bezig…' : 'Opslaan'}
      </Button>

      {state.error && <span className="text-xs text-[var(--color-danger)]">{state.error}</span>}
      {state.ok && <span className="text-xs text-[var(--color-private)]">{state.ok}</span>}
    </form>
  )
}
