import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { CURRENCY_CODES } from '@/config/currencies'
import { DonationFormPanel } from '@/modules/donations/donation-form-panel'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { findCharityIdBySlug, listCharityOptions } from '@/server/modules/charities/options'

export const metadata: Metadata = { title: 'Donatie toevoegen' }

/**
 * Reached both from the donation list and from a charity detail page (§15).
 * The charity slug only preselects the recipient — the donation itself still
 * goes through the phase-3 flow, including the name snapshot.
 */
export default async function NewDonationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await requireActorOrRedirect()
  const params = await searchParams

  const slug = typeof params.charity === 'string' ? params.charity : undefined

  const [charities, preselected] = await Promise.all([
    listCharityOptions(),
    slug ? findCharityIdBySlug(slug) : Promise.resolve(null),
  ])

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/donations"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar donaties
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Donatie toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <DonationFormPanel
            currencies={CURRENCY_CODES}
            defaultCurrency={actor.defaultCurrency}
            charities={charities}
            initialCharityId={preselected}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export const dynamic = 'force-dynamic'
