import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { AppError } from "@/lib/errors";
import { getPropertyDetail } from "@/repositories/properties";
import { formatDate, formatPrice, humanize } from "@/lib/format";
import { PageHeader, Pill, ScoreBadge, Section } from "@/components/ui";
import { Timeline, buildTimeline } from "@/components/timeline";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireTenant();
  let p: Awaited<ReturnType<typeof getPropertyDetail>>;
  try {
    p = await getPropertyDetail(db, ctx, id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const timeline = buildTimeline(p.listings);
  return (
    <>
      <PageHeader title={p.addressLine ?? "Property"} subtitle={`${[p.municipality, p.province].filter(Boolean).join(" · ")} · ${humanize(p.propertyType)}${p.bedrooms ? ` · ${p.bedrooms} bedrooms` : ""}${p.surfaceArea ? ` · ${p.surfaceArea} m²` : ""}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Property timeline">
            <Timeline entries={timeline} />
          </Section>
          <Section title="Listings (advertisements)">
            <table className="table">
              <thead><tr><th>Source</th><th>Seller</th><th>Price</th><th>First seen</th><th>Last seen</th><th>Status</th><th>Snapshots</th><th>Match</th></tr></thead>
              <tbody>
                {p.listings.map((l) => (
                  <tr key={l.id}>
                    <td>{l.source.name}<p className="text-xs text-ink-500">{l.sourceListingId}</p></td>
                    <td><Pill value={l.sellerType} /> <span className="text-xs text-ink-500">{Math.round(l.sellerConfidence * 100)}%</span></td>
                    <td className="tabular-nums">{formatPrice(l.currentPrice)}{l.initialPrice && l.initialPrice !== l.currentPrice ? <p className="text-xs text-ink-500">from {formatPrice(l.initialPrice)}</p> : null}</td>
                    <td>{formatDate(l.firstSeenAt)}</td>
                    <td>{formatDate(l.lastSeenAt)}</td>
                    <td><Pill value={l.status} /></td>
                    <td>{l.snapshots.length}</td>
                    <td className="text-xs text-ink-500">{l.matchDecision ? `${humanize(l.matchDecision)} ${l.matchConfidence !== null ? `${Math.round(l.matchConfidence * 100)}%` : ""}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="Snapshot history">
            <table className="table">
              <thead><tr><th>Captured</th><th>Source</th><th>Price</th><th>Seller</th><th>Status</th><th>Title</th></tr></thead>
              <tbody>
                {p.listings.flatMap((l) => l.snapshots.map((s) => ({ s, l }))).sort((a, b) => a.s.capturedAt.getTime() - b.s.capturedAt.getTime()).map(({ s, l }) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">{formatDate(s.capturedAt)}</td>
                    <td className="text-xs text-ink-500">{l.source.name}</td>
                    <td className="tabular-nums">{formatPrice(s.price)}</td>
                    <td><Pill value={s.sellerType} /></td>
                    <td><Pill value={s.status} /></td>
                    <td className="max-w-xs truncate text-ink-600">{s.title ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Opportunities (your agency)">
            {p.opportunities.length ? (
              <ul className="space-y-2">
                {p.opportunities.map((o) => (
                  <li key={o.id} className="flex items-center gap-3">
                    <ScoreBadge score={o.score} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/opportunities/${o.id}`} className="text-sm font-medium hover:text-brand-700">{o.headline}</Link>
                      <p className="text-xs text-ink-500"><Pill value={o.status} /> {o.assignedUser?.name ?? ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-500">No opportunities for this property.</p>}
          </Section>
          <Section title="CRM relationships (your agency)">
            {p.relationships.length ? (
              <ul className="space-y-1 text-sm">
                {p.relationships.map((r) => (
                  <li key={r.id}><Link href={`/contacts/${r.contact.id}`} className="font-medium hover:text-brand-700">{[r.contact.firstName, r.contact.lastName].filter(Boolean).join(" ")}</Link> · {humanize(r.relationshipType)}{r.year ? ` — ${r.year}` : ""}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-500">No known relationship in your CRM.</p>}
          </Section>
        </div>
      </div>
    </>
  );
}
