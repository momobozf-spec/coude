import { SourceSettingsForm } from './form'

import { formatDateTime, formatRelative, healthLabel, healthTone } from '@/components/format'
import { Badge, EmptyState, Panel, Table, Td, Th } from '@/components/ui'
import { allCollectors, isSourceAllowedByEnv } from '@/collectors/registry'
import { getEnv } from '@/lib/env'
import { listSources, recentRuns } from '@/repositories/sourceRepository'

export const dynamic = 'force-dynamic'

const ACCESS_METHOD_LABELS: Record<string, string> = {
  OFFICIAL_API: 'officiële API',
  PUBLIC_FEED: 'publieke feed',
  STRUCTURED_DATA: 'JSON-LD',
  PUBLIC_HTML: 'publieke HTML',
  FIXTURE: 'lokale fixtures',
  SYNTHETIC: 'gegenereerd',
}

export default async function SourcesPage() {
  const now = new Date()
  const env = getEnv()

  const [sources, runs] = await Promise.all([listSources(), recentRuns(40)])
  const registered = allCollectors()

  // Runs per bron, zodat elke rij zijn eigen recente geschiedenis toont.
  const runsBySource = new Map<string, typeof runs>()
  for (const run of runs) {
    const existing = runsBySource.get(run.source.key) ?? []
    if (existing.length < 5) runsBySource.set(run.source.key, [...existing, run])
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Twee schakelaars"
        subtitle="Een bron draait alleen als hij hier aanstaat én in COLLECTOR_ENABLED_SOURCES staat."
      >
        <div className="space-y-2 p-4 text-xs text-[var(--color-ink-soft)]">
          <p>
            De env-variabele ligt bij wie de omgeving deployt, het vinkje hieronder bij wie de
            dienst bedient. Zo kan een bron niet per ongeluk aangaan in productie doordat iemand
            hier klikte, en niet stilletjes aanstaan doordat een seed hem aanzette.
          </p>
          <p>
            Nu toegestaan:{' '}
            {env.COLLECTOR_ENABLED_SOURCES.length === 0 ? (
              <span className="text-[var(--color-danger)]">niets — geen enkele bron zal draaien</span>
            ) : (
              <code className="text-[var(--color-ink)]">
                {env.COLLECTOR_ENABLED_SOURCES.join(', ')}
              </code>
            )}
          </p>
        </div>
      </Panel>

      {sources.length === 0 ? (
        <Panel title="Bronnen">
          <EmptyState>
            Nog geen bronrijen. Start `npm run worker` of `npm run collect` — die registreren de
            collectors bij het opstarten.
          </EmptyState>
        </Panel>
      ) : (
        sources.map((source) => {
          const definition = registered.find((collector) => collector.key === source.key)
          const allowed = isSourceAllowedByEnv(source.key)
          const sourceRuns = runsBySource.get(source.key) ?? []

          return (
            <Panel
              key={source.id}
              title={source.name}
              subtitle={`${source.key} · ${ACCESS_METHOD_LABELS[source.accessMethod] ?? source.accessMethod}`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={source.enabled ? healthTone(source.health) : 'neutral'}>
                    {source.enabled ? healthLabel(source.health) : 'uit'}
                  </Badge>
                  <Badge tone={allowed ? 'neutral' : 'warn'}>
                    {allowed ? 'in env-allowlist' : 'niet in env-allowlist'}
                  </Badge>
                  {definition?.requiresBrowser && <Badge tone="warn">browser nodig</Badge>}
                </div>
              }
            >
              <div className="space-y-4 p-4">
                {source.accessNotes && (
                  <p className="rounded bg-[var(--color-panel-soft)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
                    <span className="font-medium text-[var(--color-ink)]">Toegangsgrond: </span>
                    {source.accessNotes}
                  </p>
                )}

                <SourceSettingsForm
                  source={{
                    key: source.key,
                    enabled: source.enabled,
                    pollIntervalSeconds: source.pollIntervalSeconds,
                    rateLimitPerMinute: source.rateLimitPerMinute,
                    timeoutMs: source.timeoutMs,
                    maxRetries: source.maxRetries,
                  }}
                />

                <div className="grid gap-2 text-xs md:grid-cols-4">
                  <Fact label="Laatste run" value={formatRelative(source.lastRunAt, now)} title={formatDateTime(source.lastRunAt)} />
                  <Fact label="Laatste succes" value={formatRelative(source.lastSuccessAt, now)} title={formatDateTime(source.lastSuccessAt)} />
                  <Fact
                    label="Opeenvolgende fouten"
                    value={String(source.consecutiveFailures)}
                    tone={source.consecutiveFailures > 0 ? 'bad' : undefined}
                  />
                  <Fact
                    label="Cooldown tot"
                    value={source.cooldownUntil && source.cooldownUntil > now ? formatDateTime(source.cooldownUntil) : '—'}
                    tone={source.cooldownUntil && source.cooldownUntil > now ? 'bad' : undefined}
                  />
                </div>

                {source.lastError && (
                  <p className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-[var(--color-danger)]">
                    {source.lastError}
                  </p>
                )}

                {sourceRuns.length > 0 && (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Status</Th>
                        <Th className="text-right">Opgehaald</Th>
                        <Th className="text-right">Nieuw</Th>
                        <Th className="text-right">Duplicaat</Th>
                        <Th className="text-right">Afgekeurd</Th>
                        <Th className="text-right">Alerts</Th>
                        <Th className="text-right">Onderdrukt</Th>
                        <Th className="text-right">Duur</Th>
                        <Th>Gestart</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceRuns.map((run) => (
                        <tr key={run.id}>
                          <Td>
                            <Badge
                              tone={
                                run.status === 'SUCCESS'
                                  ? 'good'
                                  : run.status === 'FAILED'
                                    ? 'bad'
                                    : 'warn'
                              }
                              title={run.error ?? undefined}
                            >
                              {run.status}
                            </Badge>
                          </Td>
                          <Td className="tabular text-right">{run.itemsFetched}</Td>
                          <Td className="tabular text-right">{run.itemsNew}</Td>
                          <Td className="tabular text-right">{run.itemsDuplicate}</Td>
                          <Td className="tabular text-right">{run.itemsRejected}</Td>
                          <Td className="tabular text-right">{run.alertsSent}</Td>
                          <Td
                            className="tabular text-right text-[var(--color-ink-soft)]"
                            title="Alerts die alle poorten passeerden maar niet verstuurd zijn: dry-run zonder bot-token, of al eerder verstuurd"
                          >
                            {run.alertsSuppressed}
                          </Td>
                          <Td className="tabular text-right text-[var(--color-ink-soft)]">
                            {run.durationMs === null ? '—' : `${run.durationMs} ms`}
                          </Td>
                          <Td className="text-[var(--color-ink-soft)]">
                            {formatDateTime(run.startedAt)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </Panel>
          )
        })
      )}
    </div>
  )
}

function Fact({
  label,
  value,
  title,
  tone,
}: {
  label: string
  value: string
  title?: string
  tone?: 'bad'
}) {
  return (
    <div className="rounded bg-[var(--color-panel-soft)] px-3 py-2" title={title}>
      <span className="block text-[11px] text-[var(--color-ink-soft)]">{label}</span>
      <span className={tone === 'bad' ? 'text-[var(--color-danger)]' : ''}>{value}</span>
    </div>
  )
}
