import { requireAgencyUser } from "@/lib/auth/current-user";
import { tenantDb } from "@/repositories/tenant-db";
import { uploadCrmCsv } from "../actions";
import { Badge, Card, EmptyState, PageHeader, fmtDate } from "../ui";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const user = await requireAgencyUser();
  const tenant = tenantDb(user.agencyId);
  const imports = await tenant.crmImports({ orderBy: { createdAt: "desc" }, take: 25 });
  const contactCount = await tenant.countCrmContacts();

  return (
    <>
      <PageHeader
        title="CRM Imports"
        subtitle={`${contactCount} contacts in your LeadRevive database. Imports never silently overwrite existing CRM data.`}
      />

      <Card className="mb-6 max-w-2xl">
        <div className="mb-2 text-sm font-semibold text-slate-900">Import a CSV export</div>
        <p className="mb-3 text-xs text-slate-500">
          Upload a contact export from your CRM (WHISE, Omnicasa, Excel…). Recognized columns include
          voornaam/achternaam, email, gsm/telefoon, postcode, gemeente, type, status, laatste_contact.
          Duplicates are detected on external ID, email and phone; conflicts are flagged, never merged silently.
        </p>
        <form action={uploadCrmCsv} className="flex items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="flex-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-300"
          />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Import
          </button>
        </form>
      </Card>

      {imports.length === 0 ? (
        <EmptyState title="No imports yet" hint="Your import history with full provenance will appear here." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3 text-right">Created</th>
                <th className="px-4 py-3 text-right">Updated</th>
                <th className="px-4 py-3 text-right">Skipped</th>
                <th className="px-4 py-3 text-right">Errors</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{imp.fileName}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={imp.status === "COMPLETED" ? "green" : imp.status === "FAILED" ? "red" : "slate"}>
                      {imp.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">{imp.totalRows}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">{imp.importedRows}</td>
                  <td className="px-4 py-2.5 text-right">{imp.updatedRows}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{imp.skippedRows}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{imp.errorRows}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(imp.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
