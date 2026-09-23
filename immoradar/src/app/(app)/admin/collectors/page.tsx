import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/tenant";
import { listSourcesWithHealth } from "@/repositories/admin";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Pill, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CollectorsPage() {
  const user = await requireUser();
  const sources = await listSourcesWithHealth(db, user);
  return (
    <>
      <PageHeader title="Collector Health" subtitle="Recent runs per source with attempts, timings and metrics." />
      <div className="space-y-6">
        {sources.map((s) => (
          <Section key={s.id} title={`${s.name} — ${s.health.toLowerCase()}`}>
            <table className="table">
              <thead><tr><th>Started</th><th>Status</th><th>Attempts</th><th>Duration</th><th>Collected</th><th>New</th><th>Updated</th><th>Unchanged</th><th>Events</th><th>Errors</th></tr></thead>
              <tbody>
                {s.runs.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-ink-500">{formatDateTime(r.startedAt)}</td>
                    <td><Pill value={r.status} /></td>
                    <td className="tabular-nums">{r.attempts}</td>
                    <td className="tabular-nums">{r.durationMs ?? "—"} ms</td>
                    <td className="tabular-nums">{r.listingsCollected}</td>
                    <td className="tabular-nums">{r.listingsNew}</td>
                    <td className="tabular-nums">{r.listingsUpdated}</td>
                    <td className="tabular-nums">{r.listingsUnchanged}</td>
                    <td className="tabular-nums">{r.eventsGenerated}</td>
                    <td className="text-xs text-hot-600">{r.errorsCount ? `${r.errorsCount} · ${r.errorMessage ?? ""}` : "—"}</td>
                  </tr>
                ))}
                {!s.runs.length ? <tr><td colSpan={10} className="text-center text-ink-500">No runs yet.</td></tr> : null}
              </tbody>
            </table>
          </Section>
        ))}
      </div>
    </>
  );
}
