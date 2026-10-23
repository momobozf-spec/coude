import { Badge, Card, CardContent } from '@/components/ui'
import { formatMoney, formatRate } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import type { StoredCalculationView } from '@/server/modules/zakat/calculation-service'

/**
 * The explanation UI (§13, §22, §23).
 *
 * Every figure here comes from stored, deterministic calculation data. Nothing
 * is recomputed in the browser and nothing is written by AI — the reason strings
 * are the ones the rule evaluators produced.
 */

const NISAB_LABELS: Record<string, string> = {
  GOLD: 'Goud',
  SILVER: 'Zilver',
  CUSTOM: 'Handmatig ingesteld',
}

const SOURCE_LABELS: Record<string, string> = {
  LIVE_PROVIDER: 'Live marktbron',
  MANUAL: 'Handmatig ingevoerd',
  FIXTURE: 'Ontwikkelwaarde (geen marktbron)',
  PUBLISHED: 'Gepubliceerde dagprijs',
}

export function ResultHeadline({ calculation }: { calculation: StoredCalculationView }) {
  const { currency } = calculation

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted">
          {calculation.status === 'FINALIZED' ? 'Zakat verschuldigd' : 'Geschatte Zakat'}
        </p>
        <p className="tabular mt-1 text-3xl font-semibold">
          {formatMoney(calculation.zakatDueMinor, currency)}
        </p>

        {!calculation.aboveNisab ? (
          <p className="mt-2 text-sm text-muted">
            Je netto Zakat-vermogen ligt onder de nisab, dus er is geen Zakat verschuldigd.
          </p>
        ) : null}

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <Figure label="Netto Zakat-vermogen" value={formatMoney(calculation.netWealthMinor, currency)} />
          <Figure label="Nisab" value={formatMoney(calculation.nisabValueMinor, currency)} />
          <Figure label="Tarief" value={formatRate(calculation.zakatRate)} />
        </dl>
      </CardContent>
    </Card>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-semibold">{value}</dd>
    </div>
  )
}

export function CalculationBreakdown({ calculation }: { calculation: StoredCalculationView }) {
  const { currency } = calculation

  const assets = calculation.items.filter((i) => i.kind === 'ASSET')
  const liabilities = calculation.items.filter((i) => i.kind === 'LIABILITY')

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className="text-sm font-semibold">Hoe is dit berekend?</h2>
        <p className="mt-1 text-sm text-muted">
          Elke post hieronder toont wat is meegeteld en waarom.
        </p>
      </section>

      <ItemList title="Vermogen" items={assets} currency={currency} />

      <TotalRow
        label="Totaal Zakat-plichtig vermogen"
        value={formatMoney(calculation.grossAssetsMinor, currency)}
      />

      <ItemList title="Verplichtingen" items={liabilities} currency={currency} />

      <TotalRow
        label="Aftrekbare verplichtingen"
        value={`− ${formatMoney(calculation.deductibleLiabilitiesMinor, currency)}`}
      />

      <TotalRow
        label="Netto Zakat-vermogen"
        value={formatMoney(calculation.netWealthMinor, currency)}
        emphasis
      />

      <Card>
        <CardContent className="flex flex-col gap-2 pt-5 text-sm">
          <Row
            label={`Nisab op ${formatDate(calculation.calculationDate)}`}
            value={formatMoney(calculation.nisabValueMinor, currency)}
          />
          <Row label="Boven nisab" value={calculation.aboveNisab ? 'Ja' : 'Nee'} />
          <Row label="Zakat-percentage" value={formatRate(calculation.zakatRate)} />
          <div className="border-t border-border pt-2">
            <Row
              label="Zakat verschuldigd"
              value={formatMoney(calculation.zakatDueMinor, currency)}
              emphasis
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ItemList({
  title,
  items,
  currency,
}: {
  title: string
  items: StoredCalculationView['items']
  currency: string
}) {
  if (items.length === 0) return null

  return (
    <Card>
      <CardContent className="pt-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <ul className="mt-2 divide-y divide-border">
          {items.map((item, index) => (
            <li key={`${item.sourceEntityId}-${index}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.originalCurrency && item.originalCurrency !== currency
                      ? `${item.originalAmount} ${item.originalCurrency} · koers ${item.exchangeRate}`
                      : null}
                    {item.zakatablePercentage && item.included
                      ? `${item.originalCurrency !== currency ? ' · ' : ''}${item.zakatablePercentage}% meegenomen`
                      : null}
                  </p>
                </div>
                <span
                  className={`tabular shrink-0 text-sm font-medium ${
                    item.included ? '' : 'text-muted line-through'
                  }`}
                >
                  {formatMoney(item.amountMinor, currency)}
                </span>
              </div>
              {item.reason ? (
                <p className="mt-1.5 text-xs text-muted">{item.reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function TotalRow({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <span className={`text-sm ${emphasis ? 'font-semibold' : 'text-muted'}`}>{label}</span>
      <span className={`tabular text-sm ${emphasis ? 'font-semibold' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  )
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={emphasis ? 'font-semibold' : 'text-muted'}>{label}</span>
      <span className={`tabular ${emphasis ? 'font-semibold' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

/**
 * Method and sources (§23).
 *
 * A fixture price is labelled as a development value, never as a market or
 * religious source.
 */
export function CalculationSources({ calculation }: { calculation: StoredCalculationView }) {
  const isFixture = calculation.nisabPriceSource === 'FIXTURE'

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5 text-sm">
        <h3 className="font-semibold">Berekeningsmethode en bronnen</h3>

        <Row label="Nisab-basis" value={NISAB_LABELS[calculation.nisabBasis] ?? calculation.nisabBasis} />
        <Row label="Regelset" value={calculation.ruleSetName ?? calculation.rulesVersion} />
        <Row label="Regelversie" value={calculation.rulesVersion} />
        <Row label="Engine" value={calculation.engineVersion} />
        <Row label="Peildatum" value={formatDate(calculation.calculationDate)} />

        {calculation.nisabMetalGrams ? (
          <Row label="Nisab-gewicht" value={`${calculation.nisabMetalGrams} gram`} />
        ) : null}

        {calculation.nisabPricePerGram ? (
          <Row
            label="Prijs per gram"
            value={`${calculation.nisabPricePerGram} ${calculation.currency}`}
          />
        ) : null}

        {calculation.nisabPriceSource ? (
          <Row
            label="Prijsbron"
            value={SOURCE_LABELS[calculation.nisabPriceSource] ?? calculation.nisabPriceSource}
          />
        ) : null}

        {calculation.nisabPriceAsOf ? (
          <Row label="Prijs waargenomen op" value={formatDate(calculation.nisabPriceAsOf)} />
        ) : null}

        {calculation.rates.length > 0 ? (
          <div className="border-t border-border pt-2">
            <p className="text-xs font-medium">Gebruikte wisselkoersen</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {calculation.rates.map((rate) => (
                <li key={`${rate.from}-${rate.to}`} className="text-xs text-muted">
                  {rate.from} → {rate.to}: {rate.rate} ({rate.provider},{' '}
                  {formatDate(rate.asOf)})
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isFixture ? (
          <Badge tone="warning" className="mt-1 self-start">
            Ontwikkelprijzen — geen live marktbron
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ZakatDisclaimer() {
  return (
    <p className="text-xs text-muted">
      Barakah helpt je een Zakat-berekening te structureren op basis van de gekozen methode en de
      gegevens die je invult. Bij twijfel over jouw persoonlijke situatie kun je advies vragen aan
      een gekwalificeerde geleerde.
    </p>
  )
}
