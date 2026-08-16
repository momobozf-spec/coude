import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/repositories/tenant-db";
import { addOpportunityNote, assignOpportunity, changeOpportunityStatus } from "../../actions";
import { Badge, Card, PageHeader, ScoreBadge, fmtCity, fmtDate, fmtEur, statusLabel, timeAgo, typeLabel } from "../../ui";
import { allowedTransitions } from "@/services/workflow-service";
import { Timeline } from "../../timeline";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAgencyUser();
  const tenant = tenantDb(user.agencyId);

  const opp = await tenant.opportunityById(id, {
    property: true,
    listing: { include: { source: true, sellerIdentity: true, snapshots: { orderBy: { capturedAt: "asc" } } } },
    contact: { include: { interactions: { orderBy: { occurredAt: "desc" }, take: 10 } } },
    scores: { orderBy: { computedAt: "desc" }, take: 1 },
    signals: { orderBy: { createdAt: "asc" } },
    assignments: { where: { active: true }, include: { assignedTo: true } },
    activities: { orderBy: { occurredAt: "desc" }, take: 20, include: { user: true } },
  });
  if (!opp) notFound();

  type FullOpp = typeof opp & {
    property: { id: string; address: string | null; city: string | null; propertyType: string; surfaceArea: number | null; bedrooms: number | null; postalCode: string | null } | null;
    listing: ({ id: string; currentPrice: number | null; firstSeenAt: Date; status: string; sellerType: string; sellerConfidence: number; propertyId: string | null; source: { name: string }; sellerIdentity: { name: string | null } | null; snapshots: { capturedAt: Date; price: number | null }[] } ) | null;
    contact: ({ id: string; firstName: string | null; lastName: string | null; contactType: string; status: string; lastContactAt: Date | null; sourceCreatedAt: Date | null; notes: string | null; assignedAgentName: string | null; interactions: { id: string; kind: string; occurredAt: Date; summary: string | null }[] }) | null;
    scores: { total: number; intentScore: number; relationshipScore: number; timingScore: number; territoryScore: number; confidenceScore: number; reasons: unknown; breakdown: unknown }[];
    signals: { id: string; kind: string; description: string }[];
    assignments: { assignedTo: { id: string; firstName: string; lastName: string } }[];
    activities: { id: string; kind: string; fromStatus: string | null; toStatus: string | null; note: string | null; occurredAt: Date; user: { firstName: string; lastName: string } | null }[];
  };
  const o = opp as FullOpp;

  const score = o.scores[0] ?? null;
  const reasons = Array.isArray(score?.reasons) ? (score!.reasons as string[]) : [];
  const agents = await tenant.agencyUsers();

  // Property timeline across ALL listings of this property
  const timelineEvents = o.property
    ? await prisma.listingEvent.findMany({
        where: { listing: { propertyId: o.property.id } },
        orderBy: { occurredAt: "asc" },
        include: { listing: { select: { sourceListingId: true } } },
      })
    : [];

  const now = new Date();
  const daysObserved = o.listing
    ? Math.floor((now.getTime() - o.listing.firstSeenAt.getTime()) / 86_400_000)
    : null;
  const priceChanges = timelineEvents.filter((e) => e.type === "PRICE_DROP" || e.type === "PRICE_INCREASE").length;
  const nextStatuses = allowedTransitions(o.status);

  return (
    <>
      <PageHeader
        title={o.property ? `${fmtCity(o.property.city)} — ${fmtEur(o.listing?.currentPrice)}` : `${o.contact?.firstName ?? ""} ${o.contact?.lastName ?? ""}`.trim() || "Opportunity"}
        subtitle={`${typeLabel(o.type)} · detected ${timeAgo(o.detectedAt)} · status ${statusLabel(o.status)}`}
      >
        <Link href="/" className="text-sm text-indigo-600 hover:underline">← Back to Today</Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left column: scoring + actions */}
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-4">
              <ScoreBadge score={score?.total ?? 0} size="lg" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Opportunity Score</div>
                <div className="text-xs text-slate-500">Weighted combination of the components below</div>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <ScoreRow label="Market intent" value={score?.intentScore ?? 0} />
              <ScoreRow label="Relationship" value={score?.relationshipScore ?? 0} />
              <ScoreRow label="Timing" value={score?.timingScore ?? 0} />
              <ScoreRow label="Territory" value={score?.territoryScore ?? 0} />
              <ScoreRow label="Data confidence" value={score?.confidenceScore ?? 0} />
            </dl>
            {reasons.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Why this score</div>
                <ul className="space-y-1 text-sm text-slate-600">
                  {reasons.map((reason) => (
                    <li key={reason}>+ {reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="mb-3 text-sm font-semibold text-slate-900">Actions</div>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((status) => (
                <form key={status} action={changeOpportunityStatus}>
                  <input type="hidden" name="opportunityId" value={o.id} />
                  <input type="hidden" name="status" value={status} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {statusLabel(status)}
                  </button>
                </form>
              ))}
            </div>
            <form action={assignOpportunity} className="mt-4 flex items-center gap-2">
              <input type="hidden" name="opportunityId" value={o.id} />
              <select name="assignedToId" required defaultValue={o.assignments[0]?.assignedTo.id ?? ""} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                <option value="" disabled>Assign to…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
                Assign
              </button>
            </form>
            <form action={addOpportunityNote} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="opportunityId" value={o.id} />
              <input name="note" required placeholder="Add a note…" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <button type="submit" className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-300">
                Note
              </button>
            </form>
          </Card>

          {o.contact ? (
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">CRM Relationship</div>
                {o.crmMatchConfidence ? (
                  <Badge tone="green">match {(o.crmMatchConfidence * 100).toFixed(0)}%</Badge>
                ) : null}
              </div>
              <div className="text-base font-medium text-slate-900">
                {o.contact.firstName} {o.contact.lastName}
              </div>
              <dl className="mt-2 space-y-1 text-sm text-slate-600">
                <div>Relationship: <span className="font-medium">{typeLabel(o.contact.contactType)}</span>{o.contact.sourceCreatedAt ? ` — ${o.contact.sourceCreatedAt.getFullYear()}` : ""}</div>
                <div>Status: {statusLabel(o.contact.status)}</div>
                <div>Last contact: {fmtDate(o.contact.lastContactAt)}</div>
                {o.contact.assignedAgentName ? <div>Assigned agent: {o.contact.assignedAgentName}</div> : null}
              </dl>
              {Array.isArray(o.crmMatchReasons) && (o.crmMatchReasons as string[]).length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {(o.crmMatchReasons as string[]).map((r) => <li key={r}>✓ {r}</li>)}
                </ul>
              ) : null}
              {o.contact.interactions.length > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">CRM history</div>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {o.contact.interactions.map((i) => (
                      <li key={i.id}>
                        <span className="font-medium">{i.kind}</span> · {fmtDate(i.occurredAt)}
                        {i.summary ? ` — ${i.summary}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {o.contact.notes ? <p className="mt-2 text-xs italic text-slate-500">{o.contact.notes}</p> : null}
            </Card>
          ) : (
            <Card>
              <div className="text-sm font-semibold text-slate-900">CRM Relationship</div>
              <p className="mt-1 text-sm text-slate-500">No CRM relationship found for this opportunity.</p>
            </Card>
          )}
        </div>

        {/* Middle column: property + seller + market intelligence */}
        <div className="space-y-5">
          {o.property ? (
            <Card>
              <div className="mb-2 text-sm font-semibold text-slate-900">Property</div>
              <dl className="space-y-1 text-sm text-slate-600">
                <div className="text-base font-medium text-slate-900">{o.property.address ?? "Address unknown"}</div>
                <div>Municipality: {fmtCity(o.property.city)} {o.property.postalCode ? `(${o.property.postalCode})` : ""}</div>
                <div>Type: {typeLabel(o.property.propertyType)}</div>
                <div>Price: {fmtEur(o.listing?.currentPrice)}</div>
                <div>Surface: {o.property.surfaceArea ? `${o.property.surfaceArea} m²` : "—"}</div>
                <div>Bedrooms: {o.property.bedrooms ?? "—"}</div>
              </dl>
              <Link href={`/properties/${o.property.id}`} className="mt-3 inline-block text-xs text-indigo-600 hover:underline">
                View full property timeline →
              </Link>
            </Card>
          ) : null}

          {o.listing ? (
            <Card>
              <div className="mb-2 text-sm font-semibold text-slate-900">Seller intelligence</div>
              <dl className="space-y-1 text-sm text-slate-600">
                <div>
                  Seller type:{" "}
                  <Badge tone={o.listing.sellerType === "PRIVATE" ? "red" : "slate"}>
                    {o.listing.sellerType}
                  </Badge>{" "}
                  <span className="text-xs text-slate-400">
                    confidence {(o.listing.sellerConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                {o.listing.sellerIdentity?.name ? <div>Seller: {o.listing.sellerIdentity.name}</div> : null}
                <div>Source: {o.listing.source.name}</div>
              </dl>
              <div className="mt-3 border-t border-slate-100 pt-2">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Market intelligence</div>
                <dl className="space-y-1 text-sm text-slate-600">
                  <div>First detected: {fmtDate(o.listing.firstSeenAt)}</div>
                  <div>Days observed: {daysObserved}</div>
                  <div>Price changes: {priceChanges}</div>
                  <div>Snapshots: {o.listing.snapshots.length}</div>
                  <div>Listing status: {statusLabel(o.listing.status)}</div>
                </dl>
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="mb-2 text-sm font-semibold text-slate-900">Signals</div>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {o.signals.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="text-indigo-500">●</span>
                  {s.description}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Right column: timeline + activity */}
        <div className="space-y-5">
          <Card>
            <div className="mb-3 text-sm font-semibold text-slate-900">Property timeline</div>
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No recorded market history.</p>
            ) : (
              <Timeline events={timelineEvents.map((e) => ({ id: e.id, type: e.type, occurredAt: e.occurredAt, payload: e.payload }))} />
            )}
          </Card>

          <Card>
            <div className="mb-3 text-sm font-semibold text-slate-900">Activity</div>
            {o.activities.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.activities.map((a) => (
                  <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                    <div className="text-slate-700">
                      {a.kind === "STATUS_CHANGE" && a.toStatus
                        ? `Status → ${statusLabel(a.toStatus)}`
                        : a.kind === "ASSIGNED"
                          ? a.note ?? "Assigned"
                          : a.note ?? a.kind}
                    </div>
                    <div className="text-xs text-slate-400">
                      {a.user ? `${a.user.firstName} ${a.user.lastName} · ` : ""}
                      {timeAgo(a.occurredAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
      <dd className="flex flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${value}%` }} />
        </div>
        <span className="w-8 text-right text-xs font-semibold text-slate-700">{value}</span>
      </dd>
    </div>
  );
}
