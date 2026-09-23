import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/tenant";
import { systemHealth } from "@/repositories/admin";
import { runJobAction } from "@/actions/admin";
import { formatDateTime } from "@/lib/format";
import { Notice, PageHeader, Section, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const h = await systemHealth(db, user);
  return (
    <>
      <PageHeader title="System Health" subtitle="Platform-wide counters and manual job triggers." />
      <Notice searchParams={sp} />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Properties" value={h.properties} />
        <Stat label="Listings" value={h.listings} />
        <Stat label="Snapshots" value={h.snapshots} />
        <Stat label="Events" value={h.events} hint={`${h.unprocessedEvents} unprocessed`} />
        <Stat label="Opportunities" value={h.opportunities} />
        <Stat label="Failed alerts" value={h.alertsFailed} />
        <Stat label="Listings needing match review" value={h.reviewMatches} />
        <Stat label="Last collector run" value={h.lastRun ? h.lastRun.status : "—"} hint={h.lastRun ? formatDateTime(h.lastRun.startedAt) : undefined} />
      </div>
      <Section title="Run jobs now">
        <div className="flex flex-wrap gap-2">
          {(["collect", "leadrevive", "digest"] as const).map((job) => (
            <form key={job} action={runJobAction}>
              <input type="hidden" name="job" value={job} />
              <button className="btn" type="submit">Run {job}</button>
            </form>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-500">In production, schedule these via cron hitting <code>/api/jobs/&lt;job&gt;</code> with the CRON_SECRET bearer token, or <code>npm run jobs:all</code>.</p>
      </Section>
    </>
  );
}
