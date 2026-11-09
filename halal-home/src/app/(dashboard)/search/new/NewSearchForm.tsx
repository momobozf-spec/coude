'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createSearchAction } from '@/modules/search/actions'

const EXAMPLES = [
  'Huis rond Gent onder €450.000, minstens 3 slaapkamers, liefst EPC A of B en dichtbij een moskee',
  'Appartement in Antwerpen tot 300k met 2 slaapkamers en een terras',
  'Woning met tuin in Leuven, minstens 150 m², geen renovatie nodig',
]

export function NewSearchForm() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    setError(null)
    const value = String(formData.get('query') ?? '').trim()

    startTransition(async () => {
      const result = await createSearchAction({ query: value })

      if (!result.ok) {
        setError(result.error ?? 'Er ging iets mis.')
        return
      }
      router.push('/search')
    })
  }

  return (
    <div className="space-y-5">
      <Card>
        <form action={submit} className="space-y-4">
          <div>
            <label htmlFor="query" className="mb-1.5 block text-sm font-medium">
              Je zoekopdracht
            </label>
            <textarea
              id="query"
              name="query"
              required
              minLength={3}
              maxLength={1000}
              rows={4}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ik zoek een huis rond Leuven onder €500.000, minstens 3 slaapkamers, liefst EPC A of B en dichtbij een moskee."
              className="w-full resize-y rounded-xl border bg-[var(--background)] p-3 text-base leading-relaxed"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Noem minstens een gemeente, een maximumprijs of een aantal slaapkamers.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[var(--color-rust-soft)]/30 px-3 py-2.5 text-sm text-[var(--color-rust-deep)]"
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'Bezig met zoeken…' : 'Zoeken'}
          </Button>
        </form>
      </Card>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Sparkles size={14} aria-hidden />
          Voorbeelden
        </p>
        <ul className="space-y-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setQuery(example)}
                className="w-full rounded-xl border p-3 text-left text-sm leading-relaxed text-[var(--muted)] transition-colors hover:bg-[var(--color-sand-100)] hover:text-[var(--foreground)]"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
