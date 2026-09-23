import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { getLeadReviveOpportunities } from "@/repositories/opportunities";
import { countContacts } from "@/repositories/contacts";
import { relativeTime } from "@/lib/format";
import { contactDisplayName } from "@/services/contact-labels";
import { OpportunityActions } from "@/components/opportunity-actions";
import { EmptyState, Notice, PageHeader, Pill, ScoreBadge } from "@/components/ui";
import type { OpportunityType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const CATEGORIES: Array<{ type: OpportunityType; label: string; hint: string }> = [
  { type: "DORMANT_VALUATION_LEAD", label: "Dormant valuation leads", hint: "Asked for a valuation, never gave a mandate" },
  { type: "FORMER_SELLER_PROSPECT", label: "Former seller prospects", hint: "Seller leads that went quiet" },
  { type: "FORMER_CLIENT", label: "Former clients", hint: "People who transacted with you before" },
  { type: "OLD_BUYER", label: "Old buyers", hint: "Bought 5+ years ago, may be moving again" },
  { type: "LOST_MANDATE", label: "Lost mandates", hint: "Chose another route last time" },
  { type: "UNCONTACTED_LEAD", label: "Uncontacted leads", hint: "In the CRM but never followed up" },
];

export default async function LeadRevivePage({ searchParams }: { searchParams: Promise<{ type?: string; error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { user, ctx } = await requireTenant();
  const now = new Date();
  const all = await getLeadReviveOpportunities(db, ctx, { now });
  const contacts = await countContacts(db, ctx);
  const users = await db.user.findMany({ where: { agencyId: ctx.agencyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const selected = CATEGORIES.find((c) => c.type === sp.type)?.type ?? null;
  const shown = selected ? all.filter((o) => o.type === selected) : all;
  const returnTo = selected ? `/leadrevive?type=${selected}` : "/leadrevive";
  return (
    <>
      <PageHeader title="LeadRevive — Dormant Opportunities" subtitle={`${all.length} dormant contacts surfaced from ${contacts} CRM contacts. These are signals of dormancy, not proof of intent to sell.`} actions={<Link href="/imports" className="btn">Import CRM data</Link>} />
      <Notice searchParams={sp} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map((c) => {
          const count = all.filter((o) => o.type === c.type).length;
          const active = selected === c.type;
          return (
            <Link key={c.type} href={active ? "/leadrevive" : `/leadrevive?type=${c.type}`} className={`card p-3 ${active ? "ring-2 ring-brand-500" : ""}`}>
              <p className="text-2xl font-semibold tabular-nums">{count}</p>
              <p className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-ink-500">{c.hint}</p>
            </Link>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No dormant opportunities" hint="Import your CRM export to let LeadRevive find dormant relationships." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Score</th><th>Contact</th><th>Reason surfaced</th><th>Relationship</th><th>Last interaction</th><th>Assigned agent</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id}>
                  <td><ScoreBadge score={o.score} size="sm" /></td>
                  <td>
                    <Link href={`/opportunities/${o.id}`} className="font-medium hover:text-brand-700">{o.contact ? contactDisplayName(o.contact) : "—"}</Link>
                    <p className="text-xs text-ink-500">{o.contact?.city ?? ""}</p>
                  </td>
                  <td className="max-w-xs text-ink-700">{o.headline}<p className="text-xs text-ink-500">{o.summary?.split(" · ").slice(2).join(" · ")}</p></td>
                  <td className="tabular-nums">{o.relationshipScore}/100</td>
                  <td className="whitespace-nowrap text-ink-600">{o.contact?.lastContactAt ? relativeTime(o.contact.lastContactAt, now) : "never"}</td>
                  <td>{o.assignedUser?.name ?? <span className="text-ink-400">Unassigned</span>}</td>
                  <td><Pill value={o.status} /></td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <Link href={`/opportunities/${o.id}`} className="btn btn-sm w-fit">Review</Link>
                      <OpportunityActions opportunityId={o.id} status={o.status} assignedUserId={o.assignedUserId} currentUserId={user.id} canAssign={hasPermission(user.role, "opportunity:assign")} users={users} returnTo={returnTo} compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
