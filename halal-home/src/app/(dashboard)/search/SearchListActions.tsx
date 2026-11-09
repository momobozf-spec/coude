'use client'

import { useState, useTransition } from 'react'
import { Bell, BellOff, Pause, Play, RefreshCw, Trash2 } from 'lucide-react'

import {
  deleteSearchAction,
  runSearchAction,
  updateSearchAction,
} from '@/modules/search/actions'

/**
 * De knoppen onder een opgeslagen zoekopdracht.
 *
 * Verwijderen vraagt om bevestiging: een zoekopdracht weggooien neemt ook de
 * matches mee, en dat is niet terug te draaien.
 */
export function SearchListActions({
  searchId,
  active,
  alertsEnabled,
}: {
  searchId: string
  active: boolean
  alertsEnabled: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function run<T>(action: () => Promise<{ ok: boolean; error?: string; data?: T }>, success?: (data: T) => string) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setMessage(result.error ?? 'Er ging iets mis.')
        return
      }
      if (success && result.data) setMessage(success(result.data))
    })
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <IconButton
          disabled={pending}
          onClick={() =>
            run(
              () => runSearchAction({ searchId }),
              (data: { matches: number; newMatches: number }) =>
                data.newMatches > 0
                  ? `${data.newMatches} nieuwe ${data.newMatches === 1 ? 'woning' : 'woningen'} gevonden`
                  : `Geen nieuwe woningen (${data.matches} totaal)`,
            )
          }
          icon={<RefreshCw size={14} aria-hidden />}
          label="Nu zoeken"
        />

        <IconButton
          disabled={pending}
          onClick={() => run(() => updateSearchAction({ searchId, active: !active }))}
          icon={active ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          label={active ? 'Pauzeren' : 'Hervatten'}
        />

        <IconButton
          disabled={pending}
          onClick={() =>
            run(() => updateSearchAction({ searchId, alertsEnabled: !alertsEnabled }))
          }
          icon={alertsEnabled ? <Bell size={14} aria-hidden /> : <BellOff size={14} aria-hidden />}
          label={alertsEnabled ? 'Meldingen aan' : 'Meldingen uit'}
        />

        {confirmingDelete ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Zeker weten?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteSearchAction({ searchId }))}
              className="font-medium text-[var(--color-rust-deep)] underline underline-offset-4"
            >
              Verwijderen
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-[var(--muted)] underline underline-offset-4"
            >
              Annuleren
            </button>
          </span>
        ) : (
          <IconButton
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            icon={<Trash2 size={14} aria-hidden />}
            label="Verwijderen"
          />
        )}
      </div>

      {message && (
        <p role="status" className="mt-2 text-xs text-[var(--muted)]">
          {message}
        </p>
      )}
    </div>
  )
}

function IconButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  )
}
