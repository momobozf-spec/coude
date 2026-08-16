import Link from "next/link";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { tenantDb } from "@/repositories/tenant-db";
import { changeOpportunityStatus, assignOpportunity } from "../actions";
import { Badge, Card, EmptyState, PageHeader, ScoreBadge, fmtDate, timeAgo, typeLabel } from "../ui";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { type: "DORMANT_VALUATION_LEAD", label: "Dormant valuation leads" },
  { type: "FORMER_SELLER_PROSPECT", label: "Former seller prospects" },
  { type: "FORMER_CLIENT", label: "Former clients" },
  { type: "OLD_BUYER", label: "Old buyers" },
  { type: "LOST_MANDATE", label: "Lost mandates" },
  { type: "UNCONTACTED_LEAD", label: "Uncontacted leads" },
] as const;

export default async function LeadRevivePage() {
  const user = await requireAgencyUser();
  const tenant = tenantDb(user.agencyId);

  const opportunities = await tenant.opportunities({
    where: {
      origin: "CRM",
      status: { in: ["NEW", "ASSIGNED", "TO_CONTACT"] },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    },
    include: {
      contact: {
        select: {
          firstName: true, lastName: true, contactType: true, status: true,
          lastContactAt: true, assignedAgentName: true,
        },
      },
      scores: { orderBy: { computedAt: "desc" }, take: 1 },
      signals: true,
      assignments: { where: { active: true }, take: 1, include: { assignedTo: { select: { firstName: true } } } },
    },
  });
  const agents = await tenant.agencyUsers();

  const byType = new Map<string, typeof opportunities>();
  for (const opp of opportunities) {
    const list = byType.get(opp.type) ?? [];
    list.push(opp);
    byType.set(opp.type, list);
  }

  return (
    <>
      <PageHeader
        title="LeadRevive — Dormant Opportunities"
        subtitle="High-potential relationships already in your CRM. Historical signals only — not proof of current intent to sell."
      />
      {opportunities.length === 0 ? (
        <EmptyState
          title="No dormant opportunities surfaced"
          hint="Import your CRM contacts to let LeadRevive scan for dormant relationships."
        />
      ) : (
        <div className="space-y-8">
          {CATEGORIES.filter((c) => byType.has(c.type)).map((category) => {
            const items = (byType.get(category.type) ?? [])
              .map((o) => ({ o, score: o.scores[0]?.relationshipScore ?? 0 }))
              .sort((a, b) => b.score - a.score);
            return (
              <section key={category.type}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {category.label} <span className="ml-1 text-slate-400">({items.length})</span>
                </h2>
                <div className="space-y-2">
                  {items.map(({ o, score }) => {
                    const surfacedReason = o.signals.find((s) => s.kind !== "UNCERTAINTY")?.description;
                    const uncertainty = o.signals.find((s) => s.kind === "UNCERTAINTY")?.description;
                    return (
                      <Card key={o.id} className="flex items-center gap-4 py-4">
                        <ScoreBadge score={score} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {o.contact?.firstName} {o.contact?.lastName}
                            </span>
                            <Badge tone="amber">{typeLabel(o.contact?.contactType ?? "")}</Badge>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-slate-500">
                            <span>Relationship score: <strong>{score}</strong></span>
                            <span>Last interaction: {o.contact?.lastContactAt ? timeAgo(o.contact.lastContactAt) : fmtDate(o.contact?.lastContactAt)}</span>
                            {o.contact?.assignedAgentName ? <span>Agent: {o.contact.assignedAgentName}</span> : null}
                            {o.assignments[0] ? <span>Working: {o.assignments[0].assignedTo.firstName}</span> : null}
                          </div>
                          {surfacedReason ? (
                            <div className="mt-1 text-xs text-slate-600">Surfaced: {surfacedReason}</div>
                          ) : null}
                          {uncertainty ? (
                            <div className="mt-0.5 text-[11px] italic text-slate-400">{uncertainty}</div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Link
                            href={`/opportunities/${o.id}`}
                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            Review
                          </Link>
                          <form action={assignOpportunity} className="flex items-center gap-1">
                            <input type="hidden" name="opportunityId" value={o.id} />
                            <select name="assignedToId" required defaultValue="" className="rounded-md border border-slate-200 px-1.5 py-1 text-xs">
                              <option value="" disabled>Assign…</option>
                              {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.firstName}</option>
                              ))}
                            </select>
                            <button type="submit" className="rounded-md bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300">✓</button>
                          </form>
                          {(["CONTACTED", "SNOOZED", "DISMISSED"] as const).map((status) => (
                            <form key={status} action={changeOpportunityStatus}>
                              <input type="hidden" name="opportunityId" value={o.id} />
                              <input type="hidden" name="status" value={status} />
                              <button type="submit" className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                                {status === "CONTACTED" ? "Contacted" : status === "SNOOZED" ? "Snooze" : "Dismiss"}
                              </button>
                            </form>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
