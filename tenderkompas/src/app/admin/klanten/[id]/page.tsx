import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessment, companyProfile, feedback, membership, organization, procedure, user } from "@/db/schema";
import { AdviceBadge, AssessmentStatusBadge, Badge, Card, Empty, Field, Flash, PageTitle, btn } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { profileToFormData } from "@/lib/profile-from-form";
import { SUBSCRIPTION_LABEL } from "@/lib/labels";
import { FEEDBACK_LABEL } from "@/lib/services/client";
import { formatBrussels } from "@/lib/time";
import { addUserAction, adminSaveProfileAction, deleteOrgAction, updateNotificationsAction, updateSubscriptionAction } from "../actions";

export const metadata = { title: "Klant" };

export default async function ClientDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const org = await db.query.organization.findFirst({ where: eq(organization.id, id) });
  if (!org) notFound();
  const [profile, users, assessments, fb] = await Promise.all([
    db.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, id) }),
    db.select({ u: user, m: membership }).from(membership).innerJoin(user, eq(user.id, membership.userId)).where(eq(membership.organizationId, id)),
    db.select({ a: assessment, p: procedure }).from(assessment).innerJoin(procedure, eq(procedure.id, assessment.procedureId)).where(eq(assessment.organizationId, id)).orderBy(desc(assessment.updatedAt)).limit(100),
    db.select({ f: feedback, p: procedure }).from(feedback).innerJoin(procedure, eq(procedure.id, feedback.procedureId)).where(eq(feedback.organizationId, id)).orderBy(desc(feedback.createdAt)).limit(50),
  ]);
  const hidden = <input type="hidden" name="organizationId" value={org.id} />;
  const visible = assessments.filter(({ a }) => a.isCurrent || a.status === "published");
  return (
    <div className="space-y-5">
      <PageTitle title={org.name} subtitle={<span className="flex gap-2">{SUBSCRIPTION_LABEL[org.subscriptionStatus]} {org.isDemo && <Badge tone="warn">Demo-organisatie: ziet enkel demo-opdrachten</Badge>}</span>} />
      <Flash searchParams={sp} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Abonnement (handmatig)">
          <form action={updateSubscriptionAction} className="space-y-2">
            {hidden}
            <select name="subscriptionStatus" defaultValue={org.subscriptionStatus}>{Object.entries(SUBSCRIPTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <textarea name="subscriptionNotes" rows={2} defaultValue={org.subscriptionNotes ?? ""} placeholder="bv. pilot tot 31/12, factuur via boekhouding" />
            <button className={btn("secondary", "sm")}>Opslaan</button>
          </form>
        </Card>
        <Card title="Notificatievoorkeuren">
          <form action={updateNotificationsAction} className="space-y-2 text-sm">
            {hidden}
            <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="weeklyDigest" defaultChecked={org.notificationSettings.weeklyDigest} /> Wekelijkse selectie</label>
            <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="changeAlerts" defaultChecked={org.notificationSettings.changeAlerts} /> Wijzigingsmeldingen gevolgde kansen</label>
            <Field label="Ontvangers" hint="Kommagescheiden. Leeg = alle gebruikers van de organisatie."><input type="text" name="recipients" defaultValue={org.notificationSettings.recipients.join(", ")} /></Field>
            <button className={btn("secondary", "sm")}>Opslaan</button>
          </form>
        </Card>
        <Card title="Gebruikers">
          <ul className="mb-3 space-y-1 text-sm">{users.map(({ u }) => <li key={u.id}>{u.name} · <span className="text-muted">{u.email}</span></li>)}{users.length === 0 && <li className="text-warn-700">Nog geen gebruikers.</li>}</ul>
          <form action={addUserAction} className="space-y-2">
            {hidden}
            <input name="name" type="text" placeholder="Naam" required />
            <input name="email" type="email" placeholder="E-mail" required />
            <input name="password" type="password" placeholder="Tijdelijk wachtwoord (min. 12 tekens)" required minLength={12} autoComplete="new-password" />
            <button className={btn("secondary", "sm")}>Gebruiker toevoegen</button>
          </form>
        </Card>
      </div>

      <Card title="Beoordelingen voor deze klant">
        {visible.length === 0 ? <Empty>Nog geen beoordelingen. Start er een vanuit een opdracht.</Empty> : (
          <table className="tk">
            <thead><tr><th>Opdracht</th><th>Versie</th><th>Status</th><th>Advies</th><th>Bijgewerkt</th></tr></thead>
            <tbody>{visible.map(({ a, p }) => (
              <tr key={a.id}>
                <td><Link className="text-navy-800 underline" href={`/admin/beoordelingen/${a.id}`}>{p.title}</Link></td>
                <td>v{a.version}</td>
                <td><AssessmentStatusBadge status={a.status} />{a.stale && <Badge tone="warn">bronwijziging</Badge>}</td>
                <td><AdviceBadge advice={a.advice} /></td>
                <td className="text-xs">{formatBrussels(a.updatedAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Card title="Feedback van de klant">
        {fb.length === 0 ? <Empty>Nog geen feedback.</Empty> : (
          <ul className="space-y-1 text-sm">{fb.map(({ f, p }) => <li key={f.id}>{formatBrussels(f.createdAt)} — <strong>{FEEDBACK_LABEL[f.kind]}</strong> · {p.title}{f.reason ? ` — “${f.reason}”` : ""}</li>)}</ul>
        )}
      </Card>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-navy-900">Bedrijfsprofiel {profile && <span className="text-sm font-normal text-muted">v{profile.version}{profile.lastConfirmedByClientAt ? ` · door klant bevestigd op ${formatBrussels(profile.lastConfirmedByClientAt, false)}` : " · nog niet door klant bevestigd"}</span>}</h2>
        <ProfileForm action={adminSaveProfileAction} initial={profileToFormData(profile)} hiddenFields={{ organizationId: org.id }} />
      </div>

      <Card title="Gegevens verwijderen">
        <form action={deleteOrgAction} className="flex flex-wrap items-end gap-2">
          {hidden}
          <Field label={`Typ "${org.name}" om alle klantgegevens (profiel, beoordelingen, feedback, digests, accounts) definitief te verwijderen`}><input name="confirmName" type="text" /></Field>
          <button className={btn("danger")}>Definitief verwijderen</button>
        </form>
      </Card>
    </div>
  );
}
