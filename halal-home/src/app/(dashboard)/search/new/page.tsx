import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { NewSearchForm } from './NewSearchForm'

export const metadata: Metadata = { title: 'Nieuwe zoekopdracht' }

export default function NewSearchPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link
        href="/search"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        Zoeken
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Wat zoek je?</h1>
        <p className="mt-1 leading-relaxed text-[var(--muted)]">
          Schrijf het gewoon op zoals je het zou vertellen. Wij zetten het om in criteria en
          houden het voor je bij.
        </p>
      </header>

      <NewSearchForm />
    </div>
  )
}
