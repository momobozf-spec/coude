import Link from "next/link";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { tenantDb } from "@/repositories/tenant-db";
import { changeOpportunityStatus, assignOpportunity } from "./actions";
import { Badge, Card, EmptyState, PageHeader, ScoreBadge, fmtCity, fmtEur, timeAgo, typeLabel } from "./ui";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireAgencyUser();
  const tenant = tenantDb(user.agencyId);

  const opportunities = await tenant.opportunities({
    where: {
      status: { in: ["NEW", "ASSIGNED", "TO_CONTACT"] },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    },
    include: {
      property: { select: { city: true, address: true } },
      listing: { select: { currentPrice: true, firstSeenAt: true } },
      contact: { select: { firstName: true, lastName: true, contactType: true } },
      scores: { orderBy: { computedAt: "desc" }, take: 1 },
      assignments: {
        where: { active: true },
        take: 1,
        include: { assignedTo: { select: { firstName: true, lastName: true } } },
      },
    },
    take: 200,
  });

  const agents = await tenant.agencyUsers();

  const ranked = opportunities
    .map((o) => ({ o, score: o.scores[0]?.total ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return (
    <>
      <PageHeader
        title="Today's Opportunities"
        subtitle={`${ranked.length} open opportunities, ranked by score — who should you contact today?`}
      />
      {ranked.length === 0 ? (
        <EmptyState
          title="No open opportunities right now"
          hint="Run the pipeline job or adjust your territories to start detecting seller signals."
        />
      ) : (
        <div className="space-y-3">
          {ranked.map(({ o, score }) => {
            const crossBadge = o.origin === "CROSS" && o.contact;
            const reasons = Array.isArray(o.scores[0]?.reasons) ? (o.scores[0]!.reasons as string[]) : [];
            const assignee = o.assignments[0]?.assignedTo;
            return (
              <Card key={o.id} className="flex items-start gap-4">
                <ScoreBadge score={score} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {crossBadge ? (
                      <Badge tone="red">EXISTING CONTACT + {typeLabel(o.type).toUpperCase()}</Badge>
                    ) : (
                      <Badge tone={o.origin === "CRM" ? "amber" : "indigo"}>{typeLabel(o.type).toUpperCase()}</Badge>
                    )}
                    <span className="text-xs text-slate-400">Detected {timeAgo(o.detectedAt)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                    <span className="text-lg font-semibold text-slate-900">
                      {o.property ? fmtCity(o.property.city) : o.contact ? `${o.contact.firstName ?? ""} ${o.contact.lastName ?? ""}`.trim() : "—"}
                    </span>
                    {o.listing?.currentPrice ? (
                      <span className="text-lg font-medium text-slate-600">{fmtEur(o.listing.currentPrice)}</span>
                    ) : null}
                    {o.property?.address ? (
                      <span className="truncate text-sm text-slate-400">{o.property.address}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    {o.contact ? (
                      <span>
                        CRM: <span className="font-medium text-slate-700">{o.contact.firstName} {o.contact.lastName}</span>{" "}
                        ({typeLabel(o.contact.contactType).toLowerCase()})
                      </span>
                    ) : null}
                    {assignee ? (
                      <span>
                        Assigned: <span className="font-medium text-slate-700">{assignee.firstName}</span>
                      </span>
                    ) : null}
                  </div>
                  {reasons.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {reasons.slice(0, 4).map((reason) => (
                        <span key={reason} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          + {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link
                    href={`/opportunities/${o.id}`}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Open
                  </Link>
                  <div className="flex gap-1.5">
                    <form action={assignOpportunity}>
                      <input type="hidden" name="opportunityId" value={o.id} />
                      <select
                        name="assignedToId"
                        className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600"
                        defaultValue=""
                        required
                      >
                        <option value="" disabled>
                          Assign…
                        </option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.firstName}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="ml-1 rounded-md bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300">
                        ✓
                      </button>
                    </form>
                  </div>
                  <div className="flex gap-1.5">
                    <ActionButton opportunityId={o.id} status="CONTACTED" label="Contacted" />
                    <ActionButton opportunityId={o.id} status="SNOOZED" label="Snooze" />
                    <ActionButton opportunityId={o.id} status="DISMISSED" label="Dismiss" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function ActionButton({ opportunityId, status, label }: { opportunityId: string; status: string; label: string }) {
  return (
    <form action={changeOpportunityStatus}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
      >
        {label}
      </button>
    </form>
  );
}
