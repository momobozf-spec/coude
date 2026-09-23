import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { getTodaysOpportunities } from "@/repositories/opportunities";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ mine?: string; error?: string; ok?: string }> }) {
  const params = await searchParams;
  const { user, ctx } = await requireTenant();
  const now = new Date();
  const mine = params.mine === "1";
  const opportunities = await getTodaysOpportunities(db, ctx, { now, assignedUserId: mine ? user.id : undefined });
  const users = await db.user.findMany({ where: { agencyId: ctx.agencyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const crmMatches = opportunities.filter((o) => o.crmMatched).length;
  const hot = opportunities.filter((o) => o.score >= 85).length;
  const returnTo = mine ? "/?mine=1" : "/";
  return (
    <>
      <PageHeader
        title="Today's Opportunities"
        subtitle={`${opportunities.length} potential sellers to contact · ${hot} hot · ${crmMatches} with an existing CRM relationship · sorted by opportunity score`}
        actions={
          <div className="flex gap-1 rounded-md border border-ink-300 p-0.5 text-sm">
            <Link href="/" className={`rounded px-3 py-1 ${!mine ? "bg-ink-900 text-white" : "text-ink-700"}`}>All</Link>
            <Link href="/?mine=1" className={`rounded px-3 py-1 ${mine ? "bg-ink-900 text-white" : "text-ink-700"}`}>Mine</Link>
          </div>
        }
      />
      <Notice searchParams={params} />
      {opportunities.length === 0 ? (
        <EmptyState title="No open opportunities" hint="Run the collectors or import your CRM to detect potential sellers." />
      ) : (
        <div className="space-y-3">
          {opportunities.map((o) => (
            <OpportunityCard key={o.id} o={o} now={now} currentUserId={user.id} canAssign={hasPermission(user.role, "opportunity:assign")} users={users} returnTo={returnTo} />
          ))}
        </div>
      )}
    </>
  );
}
