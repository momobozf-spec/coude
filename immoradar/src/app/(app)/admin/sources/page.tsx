import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/tenant";
import { listSourcesWithHealth } from "@/repositories/admin";
import { toggleSourceAction } from "@/actions/admin";
import { formatDateTime, humanize } from "@/lib/format";
import { Notice, PageHeader, Pill, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const sources = await listSourcesWithHealth(db, user);
  return (
    <>
      <PageHeader title="Sources" subtitle="Only sources with an established, permitted integration method are collected. Fixture sources emulate a portal API and a private-listing feed." />
      <Notice searchParams={sp} />
      <Section title={`${sources.length} sources`}>
        <table className="table">
          <thead><tr><th>Source</th><th>Kind</th><th>Access</th><th>Health</th><th>Listings</th><th>Poll</th><th>Rate limit</th><th>Last success</th><th>Last failure</th><th></th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}<p className="text-xs text-ink-500">{s.key}</p></td>
                <td>{humanize(s.kind)}</td>
                <td className="max-w-xs text-xs text-ink-600">{s.accessNote ?? "—"}</td>
                <td><Pill value={s.health} />{s.consecutiveFailures ? <p className="text-xs text-ink-500">{s.consecutiveFailures} consecutive failures</p> : null}</td>
                <td className="tabular-nums">{s._count.listings}</td>
                <td>{s.pollIntervalMinutes} min</td>
                <td>{s.rateLimitPerMinute}/min · {s.timeoutMs} ms · {s.maxRetries} retries</td>
                <td className="text-xs text-ink-500">{formatDateTime(s.lastSuccessAt)}</td>
                <td className="text-xs text-ink-500">{formatDateTime(s.lastFailureAt)}</td>
                <td>
                  <form action={toggleSourceAction}>
                    <input type="hidden" name="sourceId" value={s.id} />
                    <button className="btn btn-sm" type="submit">{s.enabled ? "Disable" : "Enable"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
