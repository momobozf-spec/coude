import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { getOpportunityDetail } from "@/repositories/opportunities";
import { formatDate, formatDateTime, formatPrice, humanize, relativeTime, daysBetween } from "@/lib/format";
import { contactDisplayName, relationshipLabelFor } from "@/services/contact-labels";
import { OpportunityActions } from "@/components/opportunity-actions";
import { noteAction, rescoreAction, statusAction } from "@/actions/opportunities";
import { Notice, PageHeader, Pill, Reasons, ScoreBadge, ScoreBar, Section } from "@/components/ui";
import { Timeline, buildTimeline } from "@/components/timeline";
import { STATUS_ORDER } from "@/services/workflow";

export const dynamic = "force-dynamic";

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { user, ctx } = await requireTenant();
  const now = new Date();
  let o: Awaited<ReturnType<typeof getOpportunityDetail>>;
  try {
    o = await getOpportunityDetail(db, ctx, id);
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
  const users = await db.user.findMany({ where: { agencyId: ctx.agencyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const reasons = (o.scoreReasons as Array<{ label: string; kind: string; weight: number }> | null) ?? [];
  const byKind = (kind: string) => reasons.filter((r) => r.kind === kind).map((r) => r.label);
  const listing = o.listing;
  const property = o.property;
  const timeline = property ? buildTimeline(property.listings) : [];
  const sellerReasons = (listing?.sellerReasons as string[] | null) ?? [];
  const crmReasons = (o.crmMatchReasons as string[] | null) ?? [];
  const returnTo = `/opportunities/${o.id}`;
  const price = listing?.currentPrice ?? o.priceAtDetection;
  const daysObserved = listing ? daysBetween(listing.firstSeenAt, now) : null;
  const priceChanges = property ? property.listings.flatMap((l) => l.events).filter((e) => e.type === "PRICE_DROP" || e.type === "PRICE_INCREASE") : [];
  const relisted = property ? property.listings.some((l) => l.events.some((e) => e.type === "RELISTED")) : false;

  return (
    <>
      <PageHeader
        title={o.headline}
        subtitle={<>{o.summary} · <Pill value={o.status} /> · detected {relativeTime(o.detectedAt, now)} · {o.engine === "LEADREVIVE" ? "LeadRevive" : "ImmoRadar"}</>}
        actions={<OpportunityActions opportunityId={o.id} status={o.status} assignedUserId={o.assignedUserId} currentUserId={user.id} canAssign={hasPermission(user.role, "opportunity:assign")} users={users} returnTo={returnTo} />}
      />
      <Notice searchParams={sp} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {property ? (
            <Section title="Property">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <p className="text-lg font-semibold">{property.addressLine ?? "Address unknown"}</p>
                  <p className="text-sm text-ink-500">{[property.municipality, property.province].filter(Boolean).join(" · ")}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                    <dt className="text-ink-500">Type</dt><dd>{humanize(property.propertyType)}</dd>
                    <dt className="text-ink-500">Price</dt><dd className="font-semibold tabular-nums">{formatPrice(price)}</dd>
                    <dt className="text-ink-500">Surface</dt><dd>{property.surfaceArea ? `${property.surfaceArea} m²` : "—"}</dd>
                    <dt className="text-ink-500">Bedrooms</dt><dd>{property.bedrooms ?? "—"}</dd>
                  </dl>
                </div>
                <div className="text-sm">
                  <Link href={`/properties/${property.id}`} className="btn btn-sm">Property history</Link>
                  {listing?.sourceUrl ? <p className="mt-2 truncate text-xs text-ink-500">{listing.source.name}</p> : null}
                </div>
              </div>
            </Section>
          ) : null}

          {listing ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Section title="Seller intelligence">
                <div className="mb-2 flex items-center gap-2">
                  <Pill value={listing.sellerType} />
                  <span className="text-sm text-ink-600">confidence {Math.round(listing.sellerConfidence * 100)}%</span>
                </div>
                <Reasons reasons={sellerReasons} />
              </Section>
              <Section title="Market intelligence">
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-ink-500">First detected</dt><dd>{formatDate(listing.firstSeenAt)}</dd>
                  <dt className="text-ink-500">Days observed</dt><dd>{daysObserved}</dd>
                  <dt className="text-ink-500">Price changes</dt><dd>{priceChanges.length} ({listing.priceDropCount} drop{listing.priceDropCount === 1 ? "" : "s"})</dd>
                  <dt className="text-ink-500">Initial price</dt><dd className="tabular-nums">{formatPrice(listing.initialPrice)}</dd>
                  <dt className="text-ink-500">Relisted</dt><dd>{relisted ? "Yes" : "No"}</dd>
                  <dt className="text-ink-500">Historical listings</dt><dd>{property?.listings.length ?? 1}</dd>
                  <dt className="text-ink-500">Listing status</dt><dd><Pill value={listing.status} /></dd>
                </dl>
              </Section>
            </div>
          ) : null}

          {property ? (
            <Section title="Property timeline">
              <Timeline entries={timeline} />
            </Section>
          ) : null}

          <Section title="Activity">
            <form action={noteAction} className="mb-4 flex gap-2">
              <input type="hidden" name="opportunityId" value={o.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input name="note" className="input" placeholder="Add a note…" maxLength={2000} required />
              <button className="btn" type="submit">Add</button>
            </form>
            <ul className="space-y-2 text-sm">
              {o.activities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-32 shrink-0 text-xs text-ink-500">{formatDateTime(a.createdAt)}</span>
                  <span>
                    <span className="font-medium">{humanize(a.type)}</span>
                    {a.toStatus && a.fromStatus !== a.toStatus ? <span className="text-ink-500"> → {humanize(a.toStatus)}</span> : null}
                    {a.note ? <span className="text-ink-700"> · {a.note}</span> : null}
                    {a.user ? <span className="text-ink-400"> · {a.user.name}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Scoring">
            <div className="mb-4 flex items-center gap-4">
              <ScoreBadge score={o.score} size="lg" />
              <div>
                <p className="text-sm font-semibold">Opportunity Score</p>
                <p className="text-xs text-ink-500">Scored {o.lastScoredAt ? relativeTime(o.lastScoredAt, now) : "—"}</p>
              </div>
            </div>
            <div className="space-y-3">
              <ScoreBar label="Intent" value={o.intentScore} />
              <ScoreBar label="Relationship" value={o.relationshipScore} />
              <ScoreBar label="Timing" value={o.timingScore} />
              <ScoreBar label="Territory" value={o.territoryScore} />
              <ScoreBar label="Data confidence" value={o.confidenceScore} />
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {(["RELATIONSHIP", "MARKET", "TERRITORY", "TIMING", "CONFIDENCE"] as const).map((kind) => {
                const items = byKind(kind);
                if (!items.length) return null;
                return (
                  <div key={kind}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{humanize(kind)}</p>
                    <Reasons reasons={items} />
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-ink-500">Scores estimate priority, not proof of intent to sell.</p>
            <form action={rescoreAction} className="mt-2">
              <input type="hidden" name="opportunityId" value={o.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="btn btn-sm" type="submit">Recompute score</button>
            </form>
          </Section>

          <Section title="CRM relationship">
            {o.contact ? (
              <div className="space-y-2 text-sm">
                <p className="text-base font-semibold"><Link href={`/contacts/${o.contact.id}`} className="hover:text-brand-700">{contactDisplayName(o.contact)}</Link></p>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-ink-500">Relationship</dt><dd>{relationshipLabelFor(o.contact)}</dd>
                  <dt className="text-ink-500">Contact type</dt><dd>{humanize(o.contact.contactType)}</dd>
                  <dt className="text-ink-500">CRM status</dt><dd>{humanize(o.contact.status)}</dd>
                  <dt className="text-ink-500">Last contact</dt><dd>{o.contact.lastContactAt ? `${formatDate(o.contact.lastContactAt)} (${relativeTime(o.contact.lastContactAt, now)})` : "—"}</dd>
                  <dt className="text-ink-500">Assigned agent</dt><dd>{o.contact.assignedUser?.name ?? o.contact.assignedAgentName ?? "—"}</dd>
                  {o.crmMatchConfidence !== null ? (<><dt className="text-ink-500">Match confidence</dt><dd>{Math.round(o.crmMatchConfidence * 100)}%</dd></>) : null}
                </dl>
                {crmReasons.length ? <Reasons reasons={crmReasons} /> : null}
                {o.contact.relationships.length ? (
                  <div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Property relationships</p>
                    <ul className="text-ink-700">
                      {o.contact.relationships.map((r) => (
                        <li key={r.id}>{humanize(r.relationshipType)}{r.year ? ` — ${r.year}` : ""}{r.note ? ` · ${r.note}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {o.contact.interactions.length ? (
                  <div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-500">CRM history</p>
                    <ul className="text-ink-700">
                      {o.contact.interactions.slice(0, 5).map((i) => (
                        <li key={i.id}>{formatDate(i.occurredAt)} · {humanize(i.type)}{i.summary ? ` · ${i.summary}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {o.contact.notes ? <p className="rounded bg-ink-50 p-2 text-ink-700">{o.contact.notes}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-ink-500">No matching contact in your CRM. Import more CRM data to discover relationships.</p>
            )}
          </Section>

          <Section title="Pipeline">
            <form action={statusAction} className="flex gap-2">
              <input type="hidden" name="opportunityId" value={o.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <select name="status" className="input" defaultValue={o.status}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{humanize(s)}</option>
                ))}
              </select>
              <button className="btn" type="submit">Update</button>
            </form>
            <p className="mt-2 text-xs text-ink-500">Assigned to {o.assignedUser?.name ?? "nobody"}{o.snoozedUntil && o.snoozedUntil > now ? ` · snoozed until ${formatDate(o.snoozedUntil)}` : ""}</p>
          </Section>

          {o.alerts.length ? (
            <Section title="Alerts">
              <ul className="space-y-1 text-sm">
                {o.alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2"><span>{humanize(a.type)}</span><span className="flex items-center gap-2 text-xs text-ink-500"><Pill value={a.status} />{formatDateTime(a.createdAt)}</span></li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
