import Link from "next/link";
import type { OpportunityListItem } from "@/repositories/opportunities";
import { formatPrice, relativeTime } from "@/lib/format";
import { relationshipLabelFor, contactDisplayName } from "@/services/contact-labels";
import { Pill, ScoreBadge } from "./ui";
import { OpportunityActions } from "./opportunity-actions";

interface Props {
  o: OpportunityListItem;
  now: Date;
  currentUserId: string;
  canAssign: boolean;
  users: Array<{ id: string; name: string }>;
  returnTo: string;
}

export function OpportunityCard({ o, now, currentUserId, canAssign, users, returnTo }: Props) {
  const reasons = ((o.scoreReasons as Array<{ label: string; kind: string }> | null) ?? []).filter((r) => r.kind !== "CONFIDENCE").slice(0, 4);
  const place = o.property?.municipality ?? o.property?.city ?? o.contact?.city ?? "—";
  const price = o.listing?.currentPrice ?? o.priceAtDetection;
  return (
    <article className={`card flex gap-4 p-4 ${o.crmMatched ? "border-l-4 border-l-hot-600" : ""}`}>
      <ScoreBadge score={o.score} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/opportunities/${o.id}`} className="text-base font-semibold uppercase tracking-wide text-ink-900 hover:text-brand-700">
            {o.headline}
          </Link>
          <Pill value={o.status} />
          {o.engine === "LEADREVIVE" ? <span className="text-xs text-ink-500">LeadRevive</span> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-700">
          <span className="font-medium text-ink-900">{place}</span>
          {price ? <span className="text-lg font-semibold tabular-nums text-ink-900">{formatPrice(price)}</span> : null}
          <span className="text-ink-500">Detected {relativeTime(o.detectedAt, now)}</span>
          {o.property?.addressLine ? <span className="text-ink-500">{o.property.addressLine}</span> : null}
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div className="text-sm">
            {o.contact ? (
              <p>
                <span className="text-ink-500">CRM relationship: </span>
                <Link href={`/contacts/${o.contact.id}`} className="font-medium text-ink-900 hover:text-brand-700">{contactDisplayName(o.contact)}</Link>
                <span className="text-ink-500"> · {relationshipLabelFor(o.contact)}</span>
                {o.contact.lastContactAt ? <span className="text-ink-500"> · last contact {relativeTime(o.contact.lastContactAt, now)}</span> : null}
              </p>
            ) : (
              <p className="text-ink-500">No CRM relationship found</p>
            )}
            <p>
              <span className="text-ink-500">Assigned: </span>
              <span className="font-medium">{o.assignedUser?.name ?? "Unassigned"}</span>
            </p>
          </div>
          <ul className="text-sm text-ink-700">
            {reasons.map((r, i) => (
              <li key={i}><span className="text-good-600">+</span> {r.label}</li>
            ))}
          </ul>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/opportunities/${o.id}`} className="btn btn-sm">Open</Link>
          <OpportunityActions opportunityId={o.id} status={o.status} assignedUserId={o.assignedUserId} currentUserId={currentUserId} canAssign={canAssign} users={users} returnTo={returnTo} compact />
        </div>
      </div>
    </article>
  );
}
