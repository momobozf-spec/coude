import {
  AgencyForm,
  DeleteTerritoryButton,
  SubscriptionForm,
  SubscriptionStatusButton,
  TerritoryForm,
} from './forms'

import { formatMoney } from '@/components/format'
import { Badge, EmptyState, Panel } from '@/components/ui'
import { PROVINCE_LABELS, type Province } from '@/domain/geo/provinces'
import { listAgencies, type AgencyOverview } from '@/services/statsService'

export const dynamic = 'force-dynamic'

/** Toont een werkgebied in één regel, afhankelijk van zijn soort. */
function territorySummary(territory: AgencyOverview['territories'][number]): string {
  switch (territory.kind) {
    case 'POSTAL_CODE':
      return territory.postalCodes.join(', ') || '(geen postcodes)'
    case 'MUNICIPALITY':
      return territory.municipalities.join(', ') || '(geen gemeenten)'
    case 'PROVINCE':
      return (
        territory.provinces
          .map((value) => PROVINCE_LABELS[value as Province] ?? value)
          .join(', ') || '(geen provincies)'
      )
    case 'RADIUS':
      return territory.centerLat === null || territory.centerLng === null
        ? '(geen middelpunt)'
        : `${territory.radiusKm ?? '?'} km rond ${territory.centerLat.toFixed(3)}, ${territory.centerLng.toFixed(3)}`
  }
}

export default async function AgenciesPage() {
  const agencies = await listAgencies()

  return (
    <div className="space-y-6">
      <Panel
        title="Nieuwe makelaar"
        subtitle="Een makelaar krijgt pas alerts wanneer hij een chat-id, een werkgebied én een actief abonnement heeft."
      >
        <AgencyForm />
      </Panel>

      {agencies.length === 0 ? (
        <Panel title="Makelaars">
          <EmptyState>Nog geen makelaars. Voeg er hierboven een toe.</EmptyState>
        </Panel>
      ) : (
        agencies.map((agency) => (
          <Panel
            key={agency.id}
            title={agency.name}
            subtitle={`${agency.territories.length} werkgebieden · ${agency.subscriptions.length} abonnementen · ${agency._count.alerts} alerts ontvangen`}
            actions={
              <div className="flex items-center gap-2">
                <Badge tone={agency.active ? 'good' : 'neutral'}>
                  {agency.active ? 'actief' : 'inactief'}
                </Badge>
                <Badge tone={agency.telegramChatId ? 'neutral' : 'warn'}>
                  {agency.telegramChatId ? 'Telegram ingesteld' : 'geen chat-id'}
                </Badge>
              </div>
            }
          >
            <div className="border-b border-[var(--color-line)]">
              <AgencyForm
                agency={{
                  id: agency.id,
                  name: agency.name,
                  contactEmail: agency.contactEmail,
                  telegramChatId: agency.telegramChatId,
                  active: agency.active,
                }}
              />
            </div>

            <div className="space-y-4 p-4">
              {/* ── Werkgebieden ─────────────────────────────────────────── */}
              <div>
                <h3 className="mb-2 text-xs font-semibold">Werkgebieden</h3>
                {agency.territories.length === 0 ? (
                  <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
                    Nog geen werkgebieden.
                  </p>
                ) : (
                  <ul className="mb-3 space-y-1">
                    {agency.territories.map((territory) => (
                      <li
                        key={territory.id}
                        className="flex flex-wrap items-center gap-2 rounded bg-[var(--color-panel-soft)] px-2 py-1.5 text-xs"
                      >
                        <Badge tone={territory.active ? 'neutral' : 'warn'}>{territory.kind}</Badge>
                        <span className="font-medium">{territory.name}</span>
                        <span className="text-[var(--color-ink-soft)]">
                          {territorySummary(territory)}
                        </span>
                        <span className="ml-auto">
                          <DeleteTerritoryButton id={territory.id} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <TerritoryForm agencyId={agency.id} />
              </div>

              {/* ── Abonnementen ─────────────────────────────────────────── */}
              <div className="border-t border-[var(--color-line)] pt-4">
                <h3 className="mb-2 text-xs font-semibold">Abonnementen</h3>
                {agency.subscriptions.length === 0 ? (
                  <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
                    Nog geen abonnementen.
                  </p>
                ) : (
                  <ul className="mb-3 space-y-1">
                    {agency.subscriptions.map((subscription) => (
                      <li
                        key={subscription.id}
                        className="flex flex-wrap items-center gap-2 rounded bg-[var(--color-panel-soft)] px-2 py-1.5 text-xs"
                      >
                        <Badge
                          tone={
                            subscription.status === 'ACTIVE'
                              ? 'good'
                              : subscription.status === 'PAUSED'
                                ? 'warn'
                                : 'bad'
                          }
                        >
                          {subscription.status}
                        </Badge>
                        <span className="font-medium">{subscription.name}</span>
                        <span className="text-[var(--color-ink-soft)]">
                          score ≥ {subscription.minLeadScore} · zekerheid ≥{' '}
                          {subscription.minPrivateConfidence.toFixed(2)}
                          {subscription.minPrice !== null || subscription.maxPrice !== null
                            ? ` · ${formatMoney(subscription.minPrice)} – ${formatMoney(subscription.maxPrice)}`
                            : ''}
                          {subscription.requirePhone ? ' · telefoon vereist' : ''}
                        </span>
                        <span className="text-[var(--color-ink-soft)]">
                          {subscription.territories
                            .map((link) => link.territory.name)
                            .join(', ') || 'geen gebied'}
                        </span>
                        <span className="ml-auto">
                          <SubscriptionStatusButton
                            id={subscription.id}
                            status={subscription.status}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <SubscriptionForm
                  agencyId={agency.id}
                  territories={agency.territories.map((territory) => ({
                    id: territory.id,
                    name: territory.name,
                  }))}
                />
              </div>
            </div>
          </Panel>
        ))
      )}
    </div>
  )
}
