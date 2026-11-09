import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck, ExternalLink, FlaskConical } from 'lucide-react'

import { Card, EmptyState } from '@/components/ui/Card'
import { ProductCard } from '@/components/financing/ProductCard'
import { findProvider } from '@/modules/financing/repository'
import { toProductView } from '@/modules/financing/service'
import { assertDemoNeverVerified, DEMO_EXPLANATION } from '@/modules/financing/domain/demo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const provider = await findProvider(id)
  return { title: provider?.name ?? 'Aanbieder' }
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const provider = await findProvider(id)
  if (!provider || !provider.active) notFound()

  // Een verzonnen aanbieder die als geverifieerd gemarkeerd staat is een
  // datafout die de UI nooit mag doorlaten.
  assertDemoNeverVerified(provider, `Aanbieder ${provider.name}`)

  const products = provider.products.map((product) =>
    toProductView({ ...product, provider }),
  )

  return (
    <div className="space-y-5">
      <Link
        href="/financing"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        Financiering
      </Link>

      {provider.isDemo && (
        <Card className="border-[var(--color-amber-deep)]/30 bg-[var(--color-amber-soft)]/15">
          <p className="flex gap-3 text-sm leading-relaxed text-[var(--muted)]">
            <FlaskConical
              size={17}
              className="mt-0.5 shrink-0 text-[var(--color-amber-deep)]"
              aria-hidden
            />
            <span>
              <span className="block font-medium text-[var(--color-amber-deep)]">
                Voorbeeldaanbieder
              </span>
              {DEMO_EXPLANATION}
            </span>
          </p>
        </Card>
      )}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--muted)]">{provider.country}</span>

          {/* Het verificatielabel gaat over het bestaan van de aanbieder, niet
              over shariah-conformiteit. Die staat per product. */}
          {provider.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-olive-100)] px-2.5 py-1 text-xs font-medium text-[var(--color-olive-700)]">
              <BadgeCheck size={12} aria-hidden />
              Bestaan en gegevens gecontroleerd
            </span>
          ) : (
            <span className="rounded-full border px-2.5 py-1 text-xs text-[var(--muted)]">
              Nog niet geverifieerd
            </span>
          )}
        </div>
      </header>

      {provider.description && (
        <Card>
          <p className="text-sm leading-relaxed">{provider.description}</p>
          {provider.website && (
            <a
              href={provider.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--accent)] underline underline-offset-4"
            >
              Website van {provider.name}
              <ExternalLink size={13} aria-hidden />
              <span className="sr-only">(opent in een nieuw tabblad)</span>
            </a>
          )}
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Producten van deze aanbieder
        </h2>

        {products.length === 0 ? (
          <Card>
            <EmptyState
              title="Geen actieve producten"
              description="Deze aanbieder heeft op dit moment geen producten in ons overzicht."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <p className="px-1 text-xs leading-relaxed text-[var(--muted)]">
        Het verificatielabel hierboven zegt dat wij het bestaan en de contactgegevens van deze
        aanbieder hebben gecontroleerd. Het zegt niets over de shariah-conformiteit van zijn
        producten — die staat per product vermeld, met de bron erbij.
      </p>
    </div>
  )
}
