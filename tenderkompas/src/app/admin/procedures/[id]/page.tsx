import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessment, extractionRun, organization } from "@/db/schema";
import { loadProcedureBundle } from "@/lib/services/procedures";
import {
  AssessmentStatusBadge,
  AdviceBadge,
  Badge,
  Card,
  Empty,
  Field,
  Flash,
  KeyValue,
  LifecycleBadge,
  Notice,
  PageTitle,
  Unknown,
  btn,
} from "@/components/ui";
import { Evidence, FactValue, LastChecked } from "@/components/evidence";
import { effectiveLifecycle, opportunityState } from "@/lib/domain/lifecycle";
import { FACT_LABEL, REQ_CATEGORY_LABEL, REQ_KIND_LABEL, SOURCE_LABEL } from "@/lib/labels";
import { formatBrussels } from "@/lib/time";
import { aiConfigured } from "@/lib/ai/extract";
import {
  addFactAction,
  addLotAction,
  addNoticeAction,
  addRequirementAction,
  fetchDocumentAction,
  runExtractionAction,
  setLifecycleAction,
  setSummaryAction,
  startAssessmentAction,
  updateCoreAction,
  updateRequirementAction,
  uploadDocumentAction,
  verifyFactAction,
} from "../actions";

export const metadata = { title: "Opdracht" };

export default async function ProcedureDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const b = await loadProcedureBundle(db, id).catch(() => null);
  if (!b) notFound();
  const { procedure: p, lots, facts, requirements, documents, notices } = b;
  const [orgs, assessments, runs] = await Promise.all([
    db.select().from(organization).orderBy(organization.name),
    db.select({ a: assessment, o: organization }).from(assessment).innerJoin(organization, eq(organization.id, assessment.organizationId)).where(eq(assessment.procedureId, id)).orderBy(desc(assessment.createdAt)),
    db.select().from(extractionRun).where(eq(extractionRun.procedureId, id)).orderBy(desc(extractionRun.createdAt)),
  ]);
  const activeFacts = facts.filter((f) => !f.supersededAt);
  const activeReqs = requirements.filter((r) => !r.supersededAt);
  const state = opportunityState(p, activeFacts, new Date());
  const lotName = (lotId: string | null) => (lotId ? lots.find((l) => l.id === lotId)?.lotKey ?? "?" : "Alle percelen");
  const hidden = <input type="hidden" name="procedureId" value={p.id} />;
  const eligibleOrgs = orgs.filter((o) => o.isDemo === p.isDemo);

  return (
    <div className="space-y-5">
      <PageTitle
        title={p.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <LifecycleBadge lifecycle={effectiveLifecycle(p)} />
            {p.lifecycleOverride && <Badge tone="warn">handmatig gecorrigeerd</Badge>}
            {!state.open && state.reason === "expired" && <Badge tone="neutral">deadline verstreken</Badge>}
            <Badge tone="neutral">{SOURCE_LABEL[p.sourceId] ?? p.sourceId}</Badge>
            {p.isDemo && <Badge tone="warn">Demo — fictief</Badge>}
            <LastChecked at={p.lastCheckedAt} />
          </span>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Kerngegevens (feiten uit bron)">
          <KeyValue
            items={[
              ["Opdrachtgever", p.buyerName],
              ["Land opdrachtgever", p.buyerCountry],
              ["Plaats van uitvoering", p.performanceNuts.length || p.performanceCountries.length ? [...p.performanceNuts, ...p.performanceCountries].join(", ") : null],
              ["Proceduretype", p.procedureType],
              ["Taal procedure", p.officialLanguages.length ? p.officialLanguages.join(", ") : null],
              ["CPV", p.cpvCodes.length ? p.cpvCodes.join(", ") : null],
              ["Officiële referentie", <code key="r" className="text-xs">{p.externalId}</code>],
              ["Omschrijving", p.description ? <span className="whitespace-pre-line">{p.description}</span> : null],
            ]}
          />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-navy-700">Kerngegevens bewerken</summary>
            <form action={updateCoreAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              {hidden}
              <div className="sm:col-span-2"><Field label="Titel"><input name="title" type="text" defaultValue={p.title} /></Field></div>
              <Field label="Opdrachtgever"><input name="buyerName" type="text" defaultValue={p.buyerName ?? ""} /></Field>
              <Field label="Proceduretype"><input name="procedureType" type="text" defaultValue={p.procedureType ?? ""} /></Field>
              <Field label="Plaats van uitvoering (NUTS)"><input name="performanceNuts" type="text" defaultValue={p.performanceNuts.join(", ")} /></Field>
              <Field label="Land(en) van uitvoering (ISO)"><input name="performanceCountries" type="text" defaultValue={p.performanceCountries.join(", ")} /></Field>
              <Field label="Taal/talen">
                <div className="flex gap-3">{["NLD", "FRA", "ENG", "DEU"].map((l) => <label key={l} className="flex items-center gap-1 font-normal"><input type="checkbox" name="officialLanguages" value={l} defaultChecked={p.officialLanguages.includes(l)} /> {l}</label>)}</div>
              </Field>
              <Field label="CPV-codes"><input name="cpvCodes" type="text" defaultValue={p.cpvCodes.join(", ")} /></Field>
              <div className="sm:col-span-2"><Field label="Omschrijving"><textarea name="description" rows={5} defaultValue={p.description ?? ""} /></Field></div>
              <div><button className={btn("primary", "sm")}>Opslaan (zet beoordelingen opnieuw ter controle)</button></div>
            </form>
          </details>
        </Card>

        <div className="space-y-5">
          <Card title="Klantbeoordelingen">
            {assessments.length === 0 ? <Empty>Nog geen beoordelingen.</Empty> : (
              <ul className="space-y-2 text-sm">
                {assessments.filter(({ a }) => a.isCurrent || a.status === "published").map(({ a, o }) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/beoordelingen/${a.id}`} className="text-navy-800 underline">{o.name} · v{a.version}</Link>
                    <span className="flex gap-1"><AssessmentStatusBadge status={a.status} /><AdviceBadge advice={a.advice} />{a.stale && <Badge tone="warn">bronwijziging</Badge>}</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={startAssessmentAction} className="mt-4 flex gap-2">
              {hidden}
              <select name="organizationId" required defaultValue="">
                <option value="" disabled>Klant kiezen…</option>
                {eligibleOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button className={btn("primary", "sm")}>Beoordelen</button>
            </form>
            {orgs.length !== eligibleOrgs.length && <p className="mt-2 text-xs text-muted">{p.isDemo ? "Demo-opdrachten enkel voor demo-klanten." : "Demo-klanten zijn uitgesloten van live opdrachten."}</p>}
          </Card>

          <Card title="Status corrigeren">
            <form action={setLifecycleAction} className="space-y-2">
              {hidden}
              <select name="lifecycle" defaultValue={p.lifecycleOverride ?? ""}>
                <option value="">Automatisch (uit publicaties): {p.lifecycle}</option>
                <option value="open">Open (oproep tot mededinging)</option>
                <option value="prior_information">Vooraankondiging</option>
                <option value="awarded">Gegund</option>
                <option value="cancelled">Ingetrokken</option>
                <option value="unknown">Onbekend</option>
              </select>
              <input type="text" name="note" placeholder="Bron/toelichting (verplicht bij correctie)" defaultValue={p.lifecycleOverrideNote ?? ""} />
              <button className={btn("secondary", "sm")}>Opslaan</button>
            </form>
          </Card>
        </div>
      </div>

      <Card title="Samenvatting (Nederlands)">
        {p.summaryNl ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {p.summaryIsTranslation && <Badge tone="info">Vertaalde samenvatting</Badge>}
            <Badge tone={p.summaryVerified ? "ok" : "warn"}>{p.summaryVerified ? "Gecontroleerd" : "Niet gecontroleerd"}</Badge>
            <Badge tone="neutral">{p.summaryMethod === "ai" ? "AI-concept" : "Handmatig"}</Badge>
          </div>
        ) : <p className="mb-3 text-sm"><Unknown>Nog geen samenvatting.</Unknown></p>}
        <form action={setSummaryAction} className="space-y-2">
          {hidden}
          <textarea name="summaryNl" rows={5} defaultValue={p.summaryNl ?? ""} placeholder="Neutrale samenvatting van de gevraagde dienstverlening." />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1 font-normal"><input type="checkbox" name="isTranslation" defaultChecked={p.summaryIsTranslation} /> Vertaling van anderstalige bron</label>
            <label className="flex items-center gap-1 font-normal"><input type="checkbox" name="verified" defaultChecked={p.summaryVerified} /> Gecontroleerd tegen bron</label>
          </div>
          <button className={btn("secondary", "sm")}>Samenvatting opslaan</button>
        </form>
      </Card>

      <Card title={`Publicaties (${notices.length})`}>
        <table className="tk">
          <thead><tr><th>Publicatie</th><th>Type</th><th>Datum</th><th>Wijziging</th><th>Opgehaald</th></tr></thead>
          <tbody>
            {notices.map((n) => (
              <tr key={n.id}>
                <td>{n.url ? <a className="underline" href={n.url} target="_blank" rel="noreferrer noopener">{n.publicationNumber}</a> : n.publicationNumber}{n.noticeVersion && <span className="text-xs text-muted"> · versie {n.noticeVersion}</span>}</td>
                <td className="text-xs">{n.noticeType ?? "—"}{n.formType ? ` / ${n.formType}` : ""}</td>
                <td className="text-xs">{n.publicationDateRaw ?? "—"}</td>
                <td className="text-xs">{n.changeDescription ?? "—"}</td>
                <td className="text-xs">{formatBrussels(n.fetchedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-navy-700">Publicatie toevoegen (rectificatie, gunning, intrekking…)</summary>
          <form action={addNoticeAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            {hidden}
            <Field label="Type"><select name="kind"><option value="change">Rectificatie / wijziging</option><option value="cn-standard">Aankondiging van opdracht</option><option value="pin-only">Vooraankondiging</option><option value="can-standard">Gunning</option><option value="cancellation">Intrekking / stopzetting</option></select></Field>
            <Field label="Referentie"><input name="reference" type="text" required defaultValue={p.externalId} /></Field>
            <Field label="Bronlink"><input name="url" type="url" /></Field>
            <Field label="Publicatiedatum"><input name="publicationDate" type="date" /></Field>
            <div className="sm:col-span-2"><Field label="Wat is gewijzigd?"><textarea name="changeDescription" rows={2} /></Field></div>
            <div><button className={btn("secondary", "sm")}>Toevoegen</button></div>
          </form>
        </details>
      </Card>

      <Card title={`Percelen (${lots.length})`}>
        {lots.length === 0 ? <p className="text-sm text-muted">Geen percelen geregistreerd (opdracht zonder percelen of nog niet ingevoerd).</p> : (
          <table className="tk"><thead><tr><th>Perceel</th><th>Titel</th><th>Omschrijving</th></tr></thead>
            <tbody>{lots.map((l) => <tr key={l.id}><td>{l.lotKey}</td><td>{l.title ?? <Unknown />}</td><td className="text-xs">{l.description ?? "—"}</td></tr>)}</tbody></table>
        )}
        <form action={addLotAction} className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_1fr_auto]">
          {hidden}
          <input name="lotKey" type="text" placeholder="Perceel (bv. 1)" required />
          <input name="title" type="text" placeholder="Titel" />
          <input name="description" type="text" placeholder="Omschrijving" />
          <button className={btn("secondary", "sm")}>Perceel opslaan</button>
        </form>
      </Card>

      <Card title="Feiten met bronbewijs">
        {activeFacts.length === 0 ? <Notice tone="warn">Nog geen deadlines of waarden vastgelegd.</Notice> : (
          <div className="overflow-x-auto">
            <table className="tk">
              <thead><tr><th>Gegeven</th><th>Perceel</th><th>Waarde</th><th>Bron & bewijs</th><th></th></tr></thead>
              <tbody>
                {activeFacts.map((f) => (
                  <tr key={f.id} className={f.verificationStatus === "rejected" || f.verificationStatus === "evidence_not_found" ? "opacity-60" : ""}>
                    <td className="text-sm">{FACT_LABEL[f.key]}</td>
                    <td className="text-xs">{lotName(f.lotId)}</td>
                    <td><FactValue f={f} /></td>
                    <td className="max-w-sm"><Evidence item={f} docs={documents} notices={notices} docHref={(d) => `/api/documents/${d}`} /></td>
                    <td className="whitespace-nowrap">
                      {(["verified", "rejected"] as const).map((s) => (
                        <form key={s} action={verifyFactAction} className="inline">
                          {hidden}<input type="hidden" name="factId" value={f.id} /><input type="hidden" name="status" value={s} />
                          <button className={btn(s === "verified" ? "secondary" : "danger", "sm") + " mr-1"} disabled={f.verificationStatus === s}>{s === "verified" ? "Bevestigen" : "Afwijzen"}</button>
                        </form>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details className="mt-3" open={activeFacts.length === 0}>
          <summary className="cursor-pointer text-sm text-navy-700">Feit toevoegen</summary>
          <form action={addFactAction} className="mt-3 grid gap-3 sm:grid-cols-3">
            {hidden}
            <Field label="Gegeven"><select name="key">{Object.entries(FACT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Perceel"><select name="lotId" defaultValue=""><option value="">Alle percelen / procedure</option>{lots.map((l) => <option key={l.id} value={l.id}>{l.lotKey}</option>)}</select></Field>
            <Field label="Waarde zoals in bron *" hint="Deadlines: bv. 20/11/2026 11:00 (Belgische tijd). Tijdzone wordt enkel overgenomen als die expliciet vermeld is."><input name="rawValue" type="text" required /></Field>
            <Field label="Getal (bedragen/duur)"><input name="valueNumber" type="text" inputMode="decimal" /></Field>
            <Field label="Eenheid / munt"><input name="unit" type="text" placeholder="EUR, MONTH…" /></Field>
            <Field label="Document"><select name="documentId" defaultValue=""><option value="">—</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.filename} v{d.version}</option>)}</select></Field>
            <Field label="Locatie in bron *" hint="Pagina, sectie of gestructureerd veld"><input name="locator" type="text" required /></Field>
            <div className="sm:col-span-2"><Field label="Bewijsfragment (kort citaat)"><input name="evidenceSnippet" type="text" maxLength={400} /></Field></div>
            <label className="flex items-center gap-1 text-sm font-normal"><input type="checkbox" name="verified" /> Ik heb dit gecontroleerd tegen de bron</label>
            <div><button className={btn("secondary", "sm")}>Feit opslaan</button></div>
          </form>
        </details>
      </Card>

      <Card title="Voorwaarden en gunningscriteria">
        {activeReqs.length === 0 ? <Notice tone="warn">Nog geen voorwaarden vastgelegd. Zonder voorwaarden kan nooit “voldaan” worden vastgesteld.</Notice> : (
          <div className="overflow-x-auto">
            <table className="tk">
              <thead><tr><th>Soort</th><th>Perceel</th><th>Eis (oorspronkelijke taal)</th><th>Verplicht</th><th>Samenwerking</th><th>Bewijs</th><th></th></tr></thead>
              <tbody>
                {activeReqs.map((r) => (
                  <tr key={r.id} className={r.verificationStatus === "rejected" || r.verificationStatus === "evidence_not_found" ? "opacity-60" : ""}>
                    <td className="text-xs">{REQ_KIND_LABEL[r.kind]}<div className="text-muted">{REQ_CATEGORY_LABEL[r.category]}</div></td>
                    <td className="text-xs">{lotName(r.lotId)}</td>
                    <td className="max-w-md text-sm">{r.text}{r.weight && <div className="text-xs text-muted">Gewicht: {r.weight}</div>}</td>
                    <td className="text-xs">{r.mandatory === true ? "Ja" : r.mandatory === false ? "Nee" : <Unknown>onduidelijk</Unknown>}</td>
                    <td className="text-xs">{r.consortiumBasis === "documented" ? <Badge tone="info" title={r.consortiumEvidence ?? ""}>Toegestaan volgens bron</Badge> : r.consortiumBasis === "not_allowed" ? <Badge tone="bad">Niet toegestaan</Badge> : <Badge tone="warn">Te controleren</Badge>}</td>
                    <td className="max-w-xs"><Evidence item={r} docs={documents} notices={notices} docHref={(d) => `/api/documents/${d}`} /></td>
                    <td className="whitespace-nowrap">
                      {(["verify", "reject", "remove"] as const).map((op) => (
                        <form key={op} action={updateRequirementAction} className="inline">
                          {hidden}<input type="hidden" name="requirementId" value={r.id} /><input type="hidden" name="op" value={op} />
                          <button className={btn(op === "verify" ? "secondary" : "danger", "sm") + " mr-1 mb-1"} disabled={op === "verify" && r.verificationStatus === "verified"}>{op === "verify" ? "Bevestigen" : op === "reject" ? "Afwijzen" : "Verwijderen"}</button>
                        </form>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details className="mt-3" open={activeReqs.length === 0}>
          <summary className="cursor-pointer text-sm text-navy-700">Voorwaarde toevoegen</summary>
          <form action={addRequirementAction} className="mt-3 grid gap-3 sm:grid-cols-3">
            {hidden}
            <Field label="Soort"><select name="kind">{Object.entries(REQ_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Categorie"><select name="category">{Object.entries(REQ_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Perceel"><select name="lotId" defaultValue=""><option value="">Alle percelen</option>{lots.map((l) => <option key={l.id} value={l.id}>{l.lotKey}</option>)}</select></Field>
            <div className="sm:col-span-3"><Field label="Eis zoals in bron *"><textarea name="text" rows={2} required /></Field></div>
            <Field label="Verplicht?"><select name="mandatory" defaultValue="unknown"><option value="yes">Ja, expliciet</option><option value="no">Nee</option><option value="unknown">Onduidelijk</option></select></Field>
            <Field label="Taal"><select name="language" defaultValue="nl"><option value="nl">nl</option><option value="fr">fr</option><option value="en">en</option><option value="de">de</option></select></Field>
            <Field label="Gewicht (gunningscriterium)"><input name="weight" type="text" /></Field>
            <Field label="Samenwerking/beroep op derden" hint="Enkel 'toegestaan' als de bron het expliciet vermeldt."><select name="consortiumBasis" defaultValue="unknown"><option value="unknown">Te controleren</option><option value="documented">Toegestaan volgens bron</option><option value="not_allowed">Niet toegestaan volgens bron</option></select></Field>
            <div className="sm:col-span-2"><Field label="Citaat over samenwerking (indien toegestaan)"><input name="consortiumEvidence" type="text" /></Field></div>
            <Field label="Document"><select name="documentId" defaultValue=""><option value="">—</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.filename} v{d.version}</option>)}</select></Field>
            <Field label="Locatie in bron *"><input name="locator" type="text" required /></Field>
            <Field label="Bewijsfragment"><input name="evidenceSnippet" type="text" maxLength={400} /></Field>
            <label className="flex items-center gap-1 text-sm font-normal"><input type="checkbox" name="verified" /> Gecontroleerd tegen bron</label>
            <div><button className={btn("secondary", "sm")}>Voorwaarde opslaan</button></div>
          </form>
        </details>
      </Card>

      <Card title="Documenten en AI-extractie">
        {documents.length === 0 ? <Empty>Nog geen documenten.</Empty> : (
          <table className="tk mb-3">
            <thead><tr><th>Document</th><th>Versie</th><th>Tekstextractie</th><th>Grootte</th><th>Toegevoegd</th></tr></thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td><a className="underline" href={`/api/documents/${d.id}`}>{d.filename}</a>{d.sourceUrl && <div className="text-xs text-muted break-all">{d.sourceUrl}</div>}</td>
                  <td>v{d.version}</td>
                  <td><Badge tone={d.textStatus === "ok" ? "ok" : d.textStatus === "pending" ? "neutral" : "bad"}>{d.textStatus === "ok" ? "Leesbaar" : d.textStatus === "low_coverage" ? "Beperkt leesbaar" : d.textStatus === "failed" ? "Onleesbaar" : "In wachtrij"}</Badge><div className="text-xs text-muted">{d.textStatusDetail}</div></td>
                  <td className="text-xs">{Math.round(d.sizeBytes / 1024)} kB</td>
                  <td className="text-xs">{formatBrussels(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <form action={uploadDocumentAction} className="space-y-2 rounded-md border border-line p-3">
            {hidden}
            <Field label="Document opladen" hint="PDF of platte tekst, max 20 MB. Enkel openbare of rechtmatig verkregen documenten."><input name="file" type="file" accept=".pdf,.txt,application/pdf,text/plain" required /></Field>
            <Field label="Bronlink van dit document"><input name="sourceUrl" type="url" /></Field>
            <button className={btn("secondary", "sm")}>Opladen</button>
          </form>
          <form action={fetchDocumentAction} className="space-y-2 rounded-md border border-line p-3">
            {hidden}
            <Field label="Document ophalen via openbare URL" hint="Enkel https, publieke adressen, max 3 redirects, PDF/tekst. Geen pagina's achter aanmelding."><input name="url" type="url" required placeholder="https://" /></Field>
            <button className={btn("secondary", "sm")}>Ophalen</button>
          </form>
        </div>
        <div className="mt-4 rounded-md border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-semibold">AI-extractie</span> — gedeeld voor alle klanten; zelfde documenten worden niet opnieuw geanalyseerd.
            </div>
            <form action={runExtractionAction}>{hidden}<button className={btn("primary", "sm")} disabled={!aiConfigured() || documents.length === 0}>Extractie uitvoeren</button></form>
          </div>
          {!aiConfigured() && <p className="mt-2 text-xs text-warn-700">AI is niet ingesteld (geen API-sleutel). Gebruik de handmatige invoer hierboven; er wordt nooit gesimuleerde AI-uitvoer getoond.</p>}
          {runs.length > 0 && (
            <table className="tk mt-3">
              <thead><tr><th>Moment</th><th>Status</th><th>Model</th><th>Tokens (in/uit)</th><th>Kosten</th><th>Controlepunten</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs">{formatBrussels(r.createdAt)}</td>
                    <td><Badge tone={r.status === "success" ? "ok" : "bad"}>{r.status}</Badge></td>
                    <td className="text-xs">{r.model}</td>
                    <td className="text-xs">{r.inputTokens ?? "—"} / {r.outputTokens ?? "—"}</td>
                    <td className="text-xs">{r.costEur ? `€ ${r.costEur}` : "onbekend (tarief niet ingesteld)"}</td>
                    <td className="max-w-md text-xs">{r.errorMessage ?? (r.validationIssues.length ? r.validationIssues.join("; ") : "geen")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
