import Link from "next/link";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { tenantDb } from "@/repositories/tenant-db";
import { PageHeader, ScoreBadge, fmtCity, fmtEur, timeAgo, typeLabel } from "../ui";

export const dynamic = "force-dynamic";

const STAGES = [
  { status: "NEW", label: "New" },
  { status: "ASSIGNED", label: "Assigned" },
  { status: "TO_CONTACT", label: "To Contact" },
  { status: "CONTACTED", label: "Contacted" },
  { status: "INTERESTED", label: "Interested" },
  { status: "VALUATION_BOOKED", label: "Valuation Booked" },
  { status: "MANDATE_PROPOSED", label: "Mandate Proposed" },
  { status: "MANDATE_WON", label: "Mandate Won" },
] as const;

export default async function PipelinePage() {
  const user = await requireAgencyUser();
  const tenant = tenantDb(user.agencyId);

  const opportunities = await tenant.opportunities({
    where: { status: { in: STAGES.map((s) => s.status) } },
    include: {
      property: { select: { city: true } },
      listing: { select: { currentPrice: true } },
      contact: { select: { firstName: true, lastName: true } },
      scores: { orderBy: { computedAt: "desc" }, take: 1 },
      assignments: { where: { active: true }, take: 1, include: { assignedTo: { select: { firstName: true } } } },
    },
  });

  const byStatus = new Map<string, typeof opportunities>();
  for (const o of opportunities) {
    const list = byStatus.get(o.status) ?? [];
    list.push(o);
    byStatus.set(o.status, list);
  }

  return (
    <>
      <PageHeader
        title="Acquisition Pipeline"
        subtitle="Lightweight lifecycle from detection to mandate — not a replacement for your CRM"
      />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const items = (byStatus.get(stage.status) ?? [])
            .map((o) => ({ o, score: o.scores[0]?.total ?? 0 }))
            .sort((a, b) => b.score - a.score);
          return (
            <div key={stage.status} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage.label}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.slice(0, 15).map(({ o, score }) => (
                  <Link
                    key={o.id}
                    href={`/opportunities/${o.id}`}
                    className="block rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300"
                  >
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={score} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {o.property ? fmtCity(o.property.city) : `${o.contact?.firstName ?? ""} ${o.contact?.lastName ?? ""}`.trim()}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {o.listing?.currentPrice ? fmtEur(o.listing.currentPrice) : typeLabel(o.type)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
                      <span>{typeLabel(o.type)}</span>
                      <span>{o.assignments[0]?.assignedTo.firstName ?? timeAgo(o.detectedAt)}</span>
                    </div>
                  </Link>
                ))}
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    Empty
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
