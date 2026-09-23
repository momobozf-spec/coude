import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { listImports } from "@/repositories/contacts";
import { importCsvAction } from "@/actions/imports";
import { formatDateTime } from "@/lib/format";
import { Notice, PageHeader, Pill, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { user, ctx } = await requireTenant();
  const imports = await listImports(db, ctx);
  return (
    <>
      <PageHeader title="CRM Imports" subtitle="Import a CSV export from your CRM. Contacts are normalized and deduplicated; existing data is never silently overwritten." />
      <Notice searchParams={sp} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Import history">
            <table className="table">
              <thead><tr><th>Started</th><th>File</th><th>By</th><th>Rows</th><th>Created</th><th>Enriched</th><th>Duplicates</th><th>Conflicts</th><th>Invalid</th><th>Status</th></tr></thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap text-ink-500">{formatDateTime(i.startedAt)}</td>
                    <td><Link href={`/imports/${i.id}`} className="font-medium hover:text-brand-700">{i.fileName ?? i.adapter}</Link></td>
                    <td>{i.user?.name ?? "—"}</td>
                    <td className="tabular-nums">{i.totalRows}</td>
                    <td className="tabular-nums">{i.createdCount}</td>
                    <td className="tabular-nums">{i.updatedCount}</td>
                    <td className="tabular-nums">{i.duplicateCount}</td>
                    <td className="tabular-nums">{i.conflictCount}</td>
                    <td className="tabular-nums">{i.invalidCount}</td>
                    <td><Pill value={i.status} /></td>
                  </tr>
                ))}
                {!imports.length ? <tr><td colSpan={10} className="text-center text-ink-500">No imports yet.</td></tr> : null}
              </tbody>
            </table>
          </Section>
        </div>
        <div className="space-y-4">
          {hasPermission(user.role, "crm:import") ? (
            <Section title="Import CSV">
              <form action={importCsvAction} className="space-y-3" encType="multipart/form-data">
                <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm" />
                <button className="btn btn-primary" type="submit">Import</button>
              </form>
            </Section>
          ) : null}
          <Section title="Supported columns">
            <p className="text-sm text-ink-600">Headers are auto-detected in Dutch, French and English. Recognised fields:</p>
            <p className="mt-2 font-mono text-xs text-ink-700">externalContactId, firstName, lastName, email, phone, address, postalCode, city, assignedAgent, contactType, leadType, status, createdAt, lastContactAt, notes, relationshipType, relationshipYear, propertyAddress</p>
            <p className="mt-2 text-xs text-ink-500">Duplicates are detected by CRM id, phone, email, then name + postal code.</p>
          </Section>
        </div>
      </div>
    </>
  );
}
