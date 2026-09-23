import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { listProperties } from "@/repositories/properties";
import { formatPrice, humanize, relativeTime } from "@/lib/format";
import { PageHeader, Pill, ScoreBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ q?: string; seller?: string; all?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await requireTenant();
  const now = new Date();
  const seller = sp.seller === "PRIVATE" || sp.seller === "PROFESSIONAL" ? sp.seller : undefined;
  const properties = await listProperties(db, ctx, { search: sp.q, sellerType: seller, inTerritory: sp.all !== "1" });
  return (
    <>
      <PageHeader title="Properties" subtitle={`${properties.length} physical properties${sp.all === "1" ? " across Belgium" : " in your territories"}, with every advertisement we have seen for them.`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search address or municipality…" className="input max-w-xs" />
        <select name="seller" defaultValue={sp.seller ?? ""} className="input w-auto">
          <option value="">All sellers</option>
          <option value="PRIVATE">Private sellers</option>
          <option value="PROFESSIONAL">Professional</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="all" value="1" defaultChecked={sp.all === "1"} /> Outside my territories too</label>
        <button className="btn" type="submit">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Address</th><th>Type</th><th>Listings</th><th>Seller</th><th>Price</th><th>Last seen</th><th>CRM link</th><th>Opportunity</th></tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const latest = p.listings[0];
              const opp = p.opportunities.sort((a, b) => b.score - a.score)[0];
              return (
                <tr key={p.id}>
                  <td><Link href={`/properties/${p.id}`} className="font-medium hover:text-brand-700">{p.addressLine ?? "—"}</Link><p className="text-xs text-ink-500">{p.municipality} · {p.province}</p></td>
                  <td>{humanize(p.propertyType)}{p.bedrooms ? ` · ${p.bedrooms} bd` : ""}{p.surfaceArea ? ` · ${p.surfaceArea} m²` : ""}</td>
                  <td>{p.listings.length}</td>
                  <td>{latest ? <Pill value={latest.sellerType} /> : "—"}</td>
                  <td className="tabular-nums">{formatPrice(latest?.currentPrice)}{latest && latest.priceDropCount > 0 ? <span className="ml-1 text-xs text-warm-600">↓{latest.priceDropCount}</span> : null}</td>
                  <td className="whitespace-nowrap text-ink-500">{latest ? relativeTime(latest.lastSeenAt, now) : "—"}{latest ? <> · <Pill value={latest.status} /></> : null}</td>
                  <td>{p.relationships.length ? <span className="text-xs text-good-600">{p.relationships.length} contact{p.relationships.length === 1 ? "" : "s"}</span> : <span className="text-xs text-ink-400">—</span>}</td>
                  <td>{opp ? <Link href={`/opportunities/${opp.id}`}><ScoreBadge score={opp.score} size="sm" /></Link> : <span className="text-xs text-ink-400">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
