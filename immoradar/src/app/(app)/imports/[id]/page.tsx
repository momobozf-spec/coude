import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { AppError } from "@/lib/errors";
import { getImport } from "@/repositories/contacts";
import { formatDateTime } from "@/lib/format";
import { Notice, PageHeader, Pill, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ImportDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx } = await requireTenant();
  let imp: Awaited<ReturnType<typeof getImport>>;
  try {
    imp = await getImport(db, ctx, id);
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
  return (
    <>
      <PageHeader title={imp.fileName ?? "Import"} subtitle={`${formatDateTime(imp.startedAt)} · ${imp.user?.name ?? "—"} · ${imp.totalRows} rows · ${imp.createdCount} created, ${imp.updatedCount} enriched, ${imp.duplicateCount} duplicates, ${imp.conflictCount} conflicts, ${imp.invalidCount} invalid`} actions={<Link href="/imports" className="btn">All imports</Link>} />
      <Notice searchParams={sp} />
      <Section title="Rows">
        <table className="table">
          <thead><tr><th>#</th><th>Status</th><th>Contact</th><th>Message</th></tr></thead>
          <tbody>
            {imp.rows.map((r) => (
              <tr key={r.id}>
                <td className="tabular-nums text-ink-500">{r.rowNumber}</td>
                <td><Pill value={r.status} /></td>
                <td>{r.contactId ? <Link href={`/contacts/${r.contactId}`} className="hover:text-brand-700">Open contact</Link> : "—"}</td>
                <td className="text-ink-700">
                  {r.message ?? "—"}
                  {Array.isArray(r.conflicts) ? (
                    <ul className="mt-1 text-xs text-ink-500">
                      {(r.conflicts as Array<{ field: string; existing: unknown; incoming: unknown }>).map((c, i) => (
                        <li key={i}>{c.field}: kept “{String(c.existing)}”, import had “{String(c.incoming)}”</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
