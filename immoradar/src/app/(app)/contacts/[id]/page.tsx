import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { getContact } from "@/repositories/contacts";
import { deleteContactAction } from "@/actions/settings";
import { formatDate, humanize, relativeTime } from "@/lib/format";
import { contactDisplayName, relationshipLabelFor } from "@/services/contact-labels";
import { PageHeader, Pill, ScoreBadge, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, ctx } = await requireTenant();
  const now = new Date();
  let c: Awaited<ReturnType<typeof getContact>>;
  try {
    c = await getContact(db, ctx, id);
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
  return (
    <>
      <PageHeader
        title={contactDisplayName(c)}
        subtitle={`${relationshipLabelFor(c)} · ${humanize(c.contactType)} · ${humanize(c.status)} · assigned to ${c.assignedUser?.name ?? c.assignedAgentName ?? "nobody"}`}
        actions={hasPermission(user.role, "crm:delete") ? (
          <form action={deleteContactAction}>
            <input type="hidden" name="contactId" value={c.id} />
            <button className="btn btn-danger" type="submit">Delete & erase personal data</button>
          </form>
        ) : null}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Contact">
            <dl className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
              <dt className="text-ink-500">Email</dt><dd>{c.email ?? "—"}</dd>
              <dt className="text-ink-500">Phone</dt><dd>{c.phone ?? "—"}</dd>
              <dt className="text-ink-500">Address</dt><dd>{[c.address, c.postalCode, c.city].filter(Boolean).join(", ") || "—"}</dd>
              <dt className="text-ink-500">CRM id</dt><dd>{c.externalContactId ?? "—"}</dd>
              <dt className="text-ink-500">Created in CRM</dt><dd>{formatDate(c.crmCreatedAt)}</dd>
              <dt className="text-ink-500">Last contact</dt><dd>{c.lastContactAt ? `${formatDate(c.lastContactAt)} (${relativeTime(c.lastContactAt, now)})` : "—"}</dd>
            </dl>
            {c.notes ? <p className="mt-3 rounded bg-ink-50 p-2 text-sm text-ink-700">{c.notes}</p> : null}
          </Section>
          <Section title="Property relationships">
            {c.relationships.length ? (
              <ul className="space-y-1 text-sm">
                {c.relationships.map((r) => (
                  <li key={r.id}>{humanize(r.relationshipType)}{r.year ? ` — ${r.year}` : ""} · {r.property ? <Link href={`/properties/${r.property.id}`} className="hover:text-brand-700">{r.property.addressLine}</Link> : r.note ?? r.addressKey ?? "unknown address"}{r.source ? <span className="text-xs text-ink-400"> · {r.source}</span> : null}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-500">None recorded.</p>}
          </Section>
          <Section title="Interactions">
            {c.interactions.length ? (
              <ul className="space-y-1 text-sm">
                {c.interactions.map((i) => (
                  <li key={i.id}>{formatDate(i.occurredAt)} · {humanize(i.type)}{i.summary ? ` · ${i.summary}` : ""}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-500">No interactions recorded.</p>}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Opportunities">
            {c.opportunities.length ? (
              <ul className="space-y-2">
                {c.opportunities.map((o) => (
                  <li key={o.id} className="flex items-center gap-3">
                    <ScoreBadge score={o.score} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/opportunities/${o.id}`} className="text-sm font-medium hover:text-brand-700">{o.headline}</Link>
                      <p className="text-xs text-ink-500"><Pill value={o.status} /> {o.property?.addressLine ?? ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-500">None.</p>}
          </Section>
          <Section title="Provenance">
            <p className="text-sm text-ink-600">Imported {c.importId ? <Link href={`/imports/${c.importId}`} className="hover:text-brand-700">via CSV import</Link> : "manually"} on {formatDate(c.createdAt)}. Original values are kept for audit.</p>
            {c.sourceValues ? <pre className="mt-2 max-h-48 overflow-auto rounded bg-ink-50 p-2 text-xs text-ink-600">{JSON.stringify(c.sourceValues, null, 2)}</pre> : null}
          </Section>
        </div>
      </div>
    </>
  );
}
