import Link from 'next/link'

import { formatDateTime, formatMoney, formatRelative, healthLabel, healthTone } from '@/components/format'
import { Badge, EmptyState, ExternalLink, Panel, StatCard, Table, Td, Th } from '@/components/ui'
import { listSources, recentRuns } from '@/repositories/sourceRepository'
import { getDashboardStats, recentAlerts } from '@/services/statsService'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const now = new Date()
  const [stats, sources, runs, alerts] = await Promise.all([
    getDashboardStats(now),
    listSources(),
    recentRuns(12),
    recentAlerts(10),
  ])

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Advertenties vandaag" value={stats.leadsToday} />
        <StatCard
          label="Particuliere leads"
          value={stats.privateLeadsToday}
          tone="good"
          hint="vandaag, actief"
        />
        <StatCard
          label="Alerts verzonden"
          value={stats.alertsSentToday}
          hint={
            stats.alertsDryRunToday > 0
              ? `+ ${stats.alertsDryRunToday} in dry-run (geen bot-token)`
              : 'vandaag'
          }
          tone={stats.alertsSentToday === 0 && stats.alertsDryRunToday > 0 ? 'warn' : 'default'}
        />
        <StatCard label="Duplicaten" value={stats.duplicatesToday} hint="vandaag herkend" />
        <StatCard label="Actieve advertenties" value={stats.activeListings} />
        <StatCard
          label="Alerts in wachtrij"
          value={stats.pendingAlerts}
          tone={stats.pendingAlerts > 0 ? 'warn' : 'default'}
          hint={stats.pendingAlerts > 0 ? 'wordt opnieuw geprobeerd' : 'niets open'}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Bronnen"
          subtitle={`${stats.sources.enabled} van ${stats.sources.total} staan aan`}
          actions={
            <Link href="/admin/sources" className="text-xs text-[var(--color-accent)] hover:underline">
              Beheren →
            </Link>
          }
        >
          {sources.length === 0 ? (
            <EmptyState>Nog geen bronnen. Start de worker om ze te registreren.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bron</Th>
                  <Th>Status</Th>
                  <Th>Interval</Th>
                  <Th>Laatste run</Th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <Td>
                      <span className="font-medium">{source.name}</span>
                      <span className="block text-[11px] text-[var(--color-ink-soft)]">
                        {source.key}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={source.enabled ? healthTone(source.health) : 'neutral'}>
                        {source.enabled ? healthLabel(source.health) : 'Uit'}
                      </Badge>
                      {source.consecutiveFailures > 0 && (
                        <span className="ml-1 text-[11px] text-[var(--color-danger)]">
                          {source.consecutiveFailures}×
                        </span>
                      )}
                    </Td>
                    <Td className="tabular">{source.pollIntervalSeconds}s</Td>
                    <Td className="text-[var(--color-ink-soft)]">
                      {formatRelative(source.lastRunAt, now)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title="Laatste alerts" subtitle="Wat er naar de makelaars ging">
          {alerts.length === 0 ? (
            <EmptyState>Nog geen alerts verstuurd.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Makelaar</Th>
                  <Th>Woning</Th>
                  <Th>Score</Th>
                  <Th>Status</Th>
                  <Th>Wanneer</Th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <Td>{alert.agency.name}</Td>
                    <Td>
                      <ExternalLink href={alert.listing.url}>
                        {[alert.listing.postalCode, alert.listing.city].filter(Boolean).join(' ') ||
                          'advertentie'}
                      </ExternalLink>
                      <span className="block text-[11px] text-[var(--color-ink-soft)]">
                        {formatMoney(alert.listing.price)}
                      </span>
                    </Td>
                    <Td className="tabular">{alert.leadScore}</Td>
                    <Td>
                      <Badge
                        tone={
                          alert.status === 'SENT'
                            ? 'good'
                            : alert.status === 'FAILED'
                              ? 'bad'
                              : 'neutral'
                        }
                        title={alert.error ?? undefined}
                      >
                        {alert.status === 'SUPPRESSED_DRY_RUN' ? 'dry-run' : alert.status}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--color-ink-soft)]">
                      {formatRelative(alert.createdAt, now)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <Panel title="Laatste collector-runs" subtitle="Nieuwste eerst">
        {runs.length === 0 ? (
          <EmptyState>Nog geen runs. Start de worker met `npm run worker`.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Bron</Th>
                <Th>Status</Th>
                <Th className="text-right">Opgehaald</Th>
                <Th className="text-right">Nieuw</Th>
                <Th className="text-right">Duplicaat</Th>
                <Th className="text-right">Gekwalificeerd</Th>
                <Th className="text-right">Alerts</Th>
                <Th className="text-right">Duur</Th>
                <Th>Gestart</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <Td>{run.source.key}</Td>
                  <Td>
                    <Badge
                      tone={
                        run.status === 'SUCCESS'
                          ? 'good'
                          : run.status === 'FAILED'
                            ? 'bad'
                            : run.status === 'PARTIAL'
                              ? 'warn'
                              : 'neutral'
                      }
                      title={run.error ?? undefined}
                    >
                      {run.status}
                    </Badge>
                  </Td>
                  <Td className="tabular text-right">{run.itemsFetched}</Td>
                  <Td className="tabular text-right">{run.itemsNew}</Td>
                  <Td className="tabular text-right">{run.itemsDuplicate}</Td>
                  <Td className="tabular text-right">{run.leadsQualified}</Td>
                  <Td className="tabular text-right">{run.alertsSent}</Td>
                  <Td className="tabular text-right text-[var(--color-ink-soft)]">
                    {run.durationMs === null ? '—' : `${run.durationMs} ms`}
                  </Td>
                  <Td className="text-[var(--color-ink-soft)]">{formatDateTime(run.startedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
