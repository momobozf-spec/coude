'use client'

import { useRouter } from 'next/navigation'

import { DonationForm, type CharityOption } from '@/modules/donations/donation-form'

/**
 * Thin client wrapper so the server page can stay a server component while the
 * form still gets a navigation callback after a successful save.
 */
export function DonationFormPanel({
  currencies,
  defaultCurrency,
  charities,
  initialCharityId,
}: {
  currencies: readonly string[]
  defaultCurrency: string
  charities: readonly CharityOption[]
  initialCharityId?: string | null
}) {
  const router = useRouter()

  return (
    <DonationForm
      currencies={currencies}
      defaultCurrency={defaultCurrency}
      charities={charities}
      initialCharityId={initialCharityId}
      onDone={() => router.push('/donations')}
    />
  )
}
