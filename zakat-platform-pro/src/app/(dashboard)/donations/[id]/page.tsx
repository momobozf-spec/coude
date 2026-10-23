import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import {
  DONATION_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/modules/donations/labels'
import { ReceiptPanel } from '@/modules/donations/receipt-panel'
import { VoidDonationButton } from '@/modules/donations/void-button'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { getDonation } from '@/server/modules/donations/service'
import { getDonationReceipt } from '@/server/modules/donations/receipt-service'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Donatie' }

export default async function DonationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireActorOrRedirect()
  const { id } = await params

  const donation = await getDonation(actor, id)

  // Only the owner can hold a receipt link; a household member sees the donation
  // but never gets a signed URL to somebody else's document.
  const receipt = donation.editable || donation.status === 'VOIDED'
    ? await getDonationReceipt(actor, id).catch(() => null)
    : null

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/donations"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar donaties
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="tabular text-2xl font-semibold">
            {formatMoney(donation.amountMinor, donation.currency)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {DONATION_TYPE_LABELS[donation.type]} · {formatDate(donation.donatedAt)}
          </p>
        </div>

        {donation.status === 'VOIDED' ? (
          <Badge tone="danger">Ingetrokken</Badge>
        ) : donation.zakatCalculationId ? (
          <Badge tone="info">Gekoppeld aan Zakat</Badge>
        ) : null}
      </header>

      {donation.status === 'VOIDED' ? (
        <Card className="border-danger/30 bg-danger-subtle/30">
          <CardContent className="pt-5 text-sm">
            Deze donatie is ingetrokken op{' '}
            {donation.voidedAt ? formatDate(donation.voidedAt) : 'een eerdere datum'} en telt niet
            meer mee.
            {donation.voidReason ? ` Reden: ${donation.voidReason}` : ''} Ze blijft bewaard omdat
            financiële historie navertelbaar moet blijven.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Row label="Ontvanger" value={donation.recipientLabel} />
          <Row label="Soort" value={DONATION_TYPE_LABELS[donation.type]} />
          <Row
            label="Bedrag"
            value={formatMoney(donation.amountMinor, donation.currency)}
          />
          <Row label="Datum" value={formatDate(donation.donatedAt)} />
          {donation.paymentMethod ? (
            <Row label="Betaalwijze" value={PAYMENT_METHOD_LABELS[donation.paymentMethod]} />
          ) : null}
          {donation.reference ? <Row label="Referentie" value={donation.reference} /> : null}
          {donation.notes ? <Row label="Notitie" value={donation.notes} /> : null}

          {donation.zakatCalculationId ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted">Zakat-berekening</span>
              <Link
                href={`/zakat/calculations/${donation.zakatCalculationId}`}
                className="font-medium text-primary hover:underline"
              >
                Bekijk berekening
              </Link>
            </div>
          ) : null}

          {donation.replacesDonationId ? (
            <Row label="Correctie van" value="Een eerdere, ingetrokken donatie" />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bewijsstuk</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceiptPanel
            donationId={donation.id}
            receipt={receipt}
            editable={donation.editable}
          />
        </CardContent>
      </Card>

      {donation.editable ? <VoidDonationButton donationId={donation.id} /> : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export const dynamic = 'force-dynamic'
