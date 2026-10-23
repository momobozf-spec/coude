import type { Metadata } from 'next'

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@/components/ui'
import { CURRENCY_CODES } from '@/config/currencies'
import { serverEnv } from '@/config/env'
import { PublishPriceForm, SyncEcbButton } from '@/modules/prices/price-forms'
import { requireAdminOrRedirect } from '@/server/auth/guards'
import { priceStatus } from '@/server/modules/prices/service'

export const metadata: Metadata = { title: 'Beheer — prijzen' }

const KIND_LABEL = {
  GOLD_PER_GRAM: 'Goud (EUR/g)',
  SILVER_PER_GRAM: 'Zilver (EUR/g)',
  FX_PER_EUR: 'Koers per EUR',
} as const

export default async function AdminPricesPage() {
  await requireAdminOrRedirect()
  const env = serverEnv()
  const rows = await priceStatus()
  const today = new Date().toISOString().slice(0, 10)
  const stale = rows.filter((row) => row.stale).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marktprijzen"
        description="De goud- en zilverprijs en de wisselkoersen waarop elke nisab-berekening rust."
      />

      {env.METAL_PRICE_PROVIDER !== 'published' || env.FX_PROVIDER !== 'published' ? (
        <Card className="border-warning">
          <CardContent className="pt-5 text-sm">
            Deze installatie rekent nog niet met gepubliceerde prijzen (METAL_PRICE_PROVIDER=
            {env.METAL_PRICE_PROVIDER}, FX_PROVIDER={env.FX_PROVIDER}). Wat je hier publiceert, wordt
            pas gebruikt als beide op <code>published</code> staan.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Stand van vandaag</CardTitle>
          <CardDescription>
            Ouder dan {env.MAX_PRICE_AGE_DAYS} dagen telt niet mee: dan weigert de app te rekenen in
            plaats van een verouderde nisab te tonen.{' '}
            {stale > 0 ? <strong>{stale} waarde(n) ontbreken of zijn te oud.</strong> : 'Alles is actueel.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Soort</th>
                  <th className="py-2 pr-3 font-medium">Valuta</th>
                  <th className="py-2 pr-3 font-medium">Waarde</th>
                  <th className="py-2 pr-3 font-medium">Dag</th>
                  <th className="py-2 pr-3 font-medium">Bron</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.currency}`} className="border-t border-border">
                    <td className="py-2 pr-3">{KIND_LABEL[row.kind]}</td>
                    <td className="py-2 pr-3">{row.currency}</td>
                    <td className="tabular py-2 pr-3">{row.value ?? '—'}</td>
                    <td className="py-2 pr-3">{row.effectiveDate?.toISOString().slice(0, 10) ?? '—'}</td>
                    <td className="max-w-56 truncate py-2 pr-3 text-muted" title={row.source ?? ''}>
                      {row.source ?? '—'}
                    </td>
                    <td className="py-2">
                      {row.value === null ? (
                        <Badge tone="danger">ontbreekt</Badge>
                      ) : row.stale ? (
                        <Badge tone="warning">{row.ageDays} d oud</Badge>
                      ) : (
                        <Badge tone="success">actueel</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publiceren</CardTitle>
          <CardDescription>
            Eén waarde per soort, valuta en dag; opnieuw publiceren voor dezelfde dag vervangt ze.
            Afgeronde berekeningen behouden de prijs waarmee ze gemaakt zijn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PublishPriceForm currencies={CURRENCY_CODES.filter((code) => code !== 'EUR')} today={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ECB-referentiekoersen</CardTitle>
          <CardDescription>
            {env.FX_SYNC === 'frankfurter'
              ? 'De worker haalt ze elk uur op. MAD, SAR en AED publiceert de ECB niet; die vul je zelf in.'
              : 'Automatisch ophalen staat uit (FX_SYNC=none). Je kunt ze hier eenmalig ophalen.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncEcbButton />
        </CardContent>
      </Card>
    </div>
  )
}

export const dynamic = 'force-dynamic'
