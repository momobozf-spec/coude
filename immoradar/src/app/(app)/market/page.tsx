import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { listMarketRadar } from "@/repositories/properties";
import { formatPrice, humanize, relativeTime } from "@/lib/format";
import { PageHeader, Pill, ScoreBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MarketRadarPage() {
  const { ctx } = await requireTenant();
  const now = new Date();
  const events = await listMarketRadar(db, ctx, { take: 150 });
  return (
    <>
      <PageHeader title="Market Radar" subtitle="Live feed of market signals across all monitored sources. Opportunities are created for signals inside your territories." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Signal</th><th>Property</th><th>Seller</th><th>Price</th><th>Source</th><th>Opportunity</th></tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const opp = e.listing.opportunities[0];
              return (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-ink-500">{relativeTime(e.occurredAt, now)}</td>
                  <td>
                    <p className="font-medium">{humanize(e.type)}</p>
                    {e.oldPrice && e.newPrice ? <p className="text-xs tabular-nums text-ink-500">{formatPrice(e.oldPrice)} → {formatPrice(e.newPrice)} ({e.percentage}%)</p> : null}
                  </td>
                  <td>
                    {e.listing.property ? <Link href={`/properties/${e.listing.property.id}`} className="hover:text-brand-700">{e.listing.property.addressLine ?? "—"}</Link> : "—"}
                    <p className="text-xs text-ink-500">{e.listing.property?.municipality}</p>
                  </td>
                  <td><Pill value={e.listing.sellerType} /></td>
                  <td className="tabular-nums">{formatPrice(e.listing.currentPrice)}</td>
                  <td className="text-xs text-ink-500">{e.listing.source.name}</td>
                  <td>{opp ? <Link href={`/opportunities/${opp.id}`} className="flex items-center gap-2"><ScoreBadge score={opp.score} size="sm" /><span className="text-xs">Open</span></Link> : <span className="text-xs text-ink-400">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
