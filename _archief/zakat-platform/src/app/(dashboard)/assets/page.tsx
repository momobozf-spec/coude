import type { Metadata } from 'next'

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from '@/components/ui'
import { assetTypeMeta, liabilityTypeMeta } from '@/config/zakat'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { assetUsage, listAssets } from '@/server/modules/assets/service'
import { liabilityUsage, listLiabilities } from '@/server/modules/liabilities/service'
import { formatDecimal } from '@/lib/money'
import { formatDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Vermogen' }

export default async function AssetsPage() {
  const actor = await requireActorOrRedirect()

  const [assets, liabilities, assetLimits, liabilityLimits] = await Promise.all([
    listAssets(actor),
    listLiabilities(actor),
    assetUsage(actor),
    liabilityUsage(actor),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vermogen"
        description="Wat je bezit en wat je nog moet betalen. Alleen jij kunt deze posten wijzigen."
        action={
          <ButtonLink href="/zakat/wizard" size="sm">
            Naar de wizard
          </ButtonLink>
        }
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Vermogensposten</h2>
          <span className="text-xs text-muted">
            {assetLimits.used}
            {assetLimits.limit === null ? '' : ` / ${assetLimits.limit}`}
          </span>
        </div>

        {assets.length === 0 ? (
          <EmptyState
            title="Nog geen vermogen ingevoerd"
            description="Voeg je posten toe via de wizard — die neemt je stap voor stap door de categorieën."
            action={
              <ButtonLink href="/zakat/wizard" size="sm">
                Beginnen
              </ButtonLink>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{asset.name}</p>
                      <p className="text-xs text-muted">
                        {assetTypeMeta(asset.type)?.label ?? asset.type}
                        {asset.zakatablePercentage
                          ? ` · ${asset.zakatablePercentage}% meegenomen`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!asset.editable ? <Badge>Gedeeld</Badge> : null}
                      <span className="tabular text-sm font-medium">
                        {asset.weightGrams
                          ? `${asset.weightGrams} g`
                          : formatDecimal(asset.value, asset.currency)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Verplichtingen</h2>
          <span className="text-xs text-muted">
            {liabilityLimits.used}
            {liabilityLimits.limit === null ? '' : ` / ${liabilityLimits.limit}`}
          </span>
        </div>

        {liabilities.length === 0 ? (
          <EmptyState
            title="Nog geen verplichtingen"
            description="Niet elke schuld is aftrekbaar. Wat meetelt, bepaalt de regelset — dat wordt per post uitgelegd."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {liabilities.map((liability) => (
              <li key={liability.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{liability.name}</p>
                      <p className="text-xs text-muted">
                        {liabilityTypeMeta(liability.type)?.label ?? liability.type}
                        {liability.dueDate ? ` · vervalt ${formatDate(liability.dueDate)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!liability.editable ? <Badge>Gedeeld</Badge> : null}
                      <span className="tabular text-sm font-medium">
                        {formatDecimal(liability.amount, liability.currency)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">
        Of een verplichting wordt afgetrokken, bepaalt de gekozen Zakat-regelset op het moment
        van berekenen. Je ziet de reden per post terug in je berekening.
      </p>
    </div>
  )
}

export const dynamic = 'force-dynamic'
